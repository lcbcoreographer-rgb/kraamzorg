import "server-only";
import { randomUUID } from "node:crypto";
import type { DadosLinkPagamento } from "@/lib/dados/tipos-contrato";
import { modoDados } from "@/lib/dados/modo";
import { criarDocumento, sandboxAutentiqueLigado } from "./autentique/cliente";
import { criarLinkPagamento } from "./infinitepay/cliente";
import { validarParcelas } from "./infinitepay/limites";
import type { SignatarioAutentiqueEntrada } from "./autentique/tipos";

/**
 * Integrações de terceiro que o contrato e a cobrança usam, escolhidas
 * pelo ambiente (P31 e P32): as de verdade em qualquer ambiente com
 * credencial, e um duplo local só no modo demonstração (KZ_DADOS), que
 * nunca fala com a rede. Sem credencial fora da demonstração, a chamada
 * falha com `ErroIntegracaoNaoConfigurada` e nada é enviado nem cobrado.
 */

export class ErroIntegracaoNaoConfigurada extends Error {
  readonly integracao: "autentique" | "infinitepay";

  constructor(integracao: "autentique" | "infinitepay") {
    super(`Integração ${integracao} sem credencial neste ambiente`);
    this.name = "ErroIntegracaoNaoConfigurada";
    this.integracao = integracao;
  }
}

export interface EntradaAssinatura {
  nomeDocumento: string;
  pdf: Uint8Array;
  gestante: SignatarioAutentiqueEntrada;
  kraamzorg: SignatarioAutentiqueEntrada;
  testemunha?: SignatarioAutentiqueEntrada;
}

export interface AssinaturaEletronica {
  /** Falso quando o documento não tem validade jurídica (sandbox, demonstração). */
  readonly ambienteDeTeste: boolean;
  criarDocumento(entrada: EntradaAssinatura): Promise<{ documentoId: string }>;
}

export interface Cobrador {
  criarLink(
    dados: DadosLinkPagamento,
  ): Promise<{ url: string; slug: string | null }>;
}

/** Origem pública do app, para o retorno e o webhook da InfinitePay. */
export function origemPublicaDoApp(padrao?: string): string {
  const configurada = process.env.APP_BASE_URL?.trim();
  return (configurada || padrao || "http://localhost:3000").replace(/\/+$/, "");
}

export function obterAssinatura(): AssinaturaEletronica {
  if (modoDados() === "demonstracao") {
    return {
      ambienteDeTeste: true,
      async criarDocumento() {
        return { documentoId: `demo-${randomUUID()}` };
      },
    };
  }
  const token = process.env.AUTENTIQUE_API_TOKEN;
  if (!token) throw new ErroIntegracaoNaoConfigurada("autentique");
  const sandbox = sandboxAutentiqueLigado();
  return {
    ambienteDeTeste: sandbox,
    async criarDocumento(entrada) {
      const documento = await criarDocumento(
        { token, sandbox },
        {
          nomeDocumento: entrada.nomeDocumento,
          arquivo: {
            nomeArquivo: `${entrada.nomeDocumento}.pdf`,
            conteudo: entrada.pdf,
            tipoConteudo: "application/pdf",
          },
          gestante: entrada.gestante,
          kraamzorg: entrada.kraamzorg,
          testemunha: entrada.testemunha,
        },
      );
      return { documentoId: documento.id };
    },
  };
}

export function obterCobrador(origemDaRequisicao?: string): Cobrador {
  if (modoDados() === "demonstracao") {
    return {
      async criarLink(dados) {
        // Mesma trava do adaptador de verdade: nunca acima do limite do pacote.
        validarParcelas(dados.parcelas, dados.parcelasMax);
        return {
          url: `https://pay.exemplo.invalid/demo/${dados.cobrancaId}`,
          slug: `demo-${dados.cobrancaId.slice(0, 8)}`,
        };
      },
    };
  }
  const handle = process.env.INFINITEPAY_HANDLE;
  if (!handle) throw new ErroIntegracaoNaoConfigurada("infinitepay");
  const apiKey = process.env.INFINITEPAY_API_KEY || undefined;
  const base = origemPublicaDoApp(origemDaRequisicao);
  return {
    async criarLink(dados) {
      const link = await criarLinkPagamento(
        { handle, apiKey },
        {
          orderNsu: dados.cobrancaId,
          itens: [
            {
              nome: dados.descricao,
              valorCentavos: dados.valorCentavos,
              quantidade: 1,
            },
          ],
          redirectUrl: `${base}/pagamento/recebido`,
          webhookUrl: `${base}/api/webhooks/infinitepay`,
          cliente: {
            nome: dados.cliente.nome,
            email: dados.cliente.email ?? undefined,
            telefone: dados.cliente.telefone ?? undefined,
          },
          parcelas: dados.parcelas,
          parcelasMaxSemJuros: dados.parcelasMax,
        },
      );
      return { url: link.url, slug: link.slug ?? null };
    },
  };
}
