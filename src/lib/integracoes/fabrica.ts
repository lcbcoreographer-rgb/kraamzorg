import "server-only";
import { randomUUID } from "node:crypto";
import type { DadosLinkPagamento } from "@/lib/dados/tipos-contrato";
import { modoDados } from "@/lib/dados/modo";
import { criarDocumento, sandboxAutentiqueLigado } from "./autentique/cliente";
import { enviarEmail } from "./email/cliente";
import {
  garantirAssuntoSemDadoPessoal,
  garantirNomeArquivoSemDadoPessoal,
} from "./email/guarda";
import type { EnviarEmailEntrada, ResultadoEnvioEmail } from "./email/tipos";
import { criarLinkPagamento } from "./infinitepay/cliente";
import { validarParcelas } from "./infinitepay/limites";
import type { SignatarioAutentiqueEntrada } from "./autentique/tipos";
import { EmissorNacionalAdaptador } from "./nfse/emissor-nacional";
import type {
  AdaptadorNfse,
  EmissaoNfseEntrada,
  ResultadoNfse,
} from "./nfse/tipos";

/**
 * Integrações de terceiro que o contrato e a cobrança usam, escolhidas
 * pelo ambiente (P31 e P32): as de verdade em qualquer ambiente com
 * credencial, e um duplo local só no modo demonstração (KZ_DADOS), que
 * nunca fala com a rede. Sem credencial fora da demonstração, a chamada
 * falha com `ErroIntegracaoNaoConfigurada` e nada é enviado nem cobrado.
 */

export class ErroIntegracaoNaoConfigurada extends Error {
  readonly integracao: "autentique" | "infinitepay" | "email" | "nfse";

  constructor(integracao: "autentique" | "infinitepay" | "email" | "nfse") {
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

// --- E-mail transacional (P41) -----------------------------------------------------------

/** E-mail sem o remetente: quem envia é o ambiente (RESEND_FROM_EMAIL). */
export type EntradaEmail = Omit<EnviarEmailEntrada, "de">;

export interface Emailer {
  /** Falso quando o e-mail sai de verdade; verdadeiro na demonstração, que só guarda na caixa de saída local. */
  readonly ambienteDeTeste: boolean;
  enviar(entrada: EntradaEmail): Promise<ResultadoEnvioEmail>;
}

/** E-mail guardado na caixa de saída da demonstração (nada sai para a rede). */
export interface EmailDemonstracao {
  id: string;
  para: string[];
  assunto: string;
  anexos: { nomeArquivo: string; tipoConteudo: string; bytes: number }[];
  enviadoEm: string;
}

const CHAVE_CAIXA_EMAIL = "__kraamzorgCaixaEmailDemo";

export function caixaDeSaidaEmailDemo(): EmailDemonstracao[] {
  const g = globalThis as unknown as Record<string, EmailDemonstracao[]>;
  g[CHAVE_CAIXA_EMAIL] ??= [];
  return g[CHAVE_CAIXA_EMAIL]!;
}

export function limparCaixaDeSaidaEmailDemo(): void {
  caixaDeSaidaEmailDemo().length = 0;
}

export function obterEmail(): Emailer {
  if (modoDados() === "demonstracao") {
    return {
      ambienteDeTeste: true,
      async enviar(entrada) {
        // Mesma trava do adaptador de verdade: assunto e nome de anexo sem dado pessoal.
        garantirAssuntoSemDadoPessoal(
          entrada.assunto,
          entrada.nomesProibidosNoAssunto,
        );
        for (const anexo of entrada.anexos ?? []) {
          garantirNomeArquivoSemDadoPessoal(
            anexo.nomeArquivo,
            entrada.nomesProibidosNoAssunto,
          );
        }
        const id = `demo-${randomUUID()}`;
        caixaDeSaidaEmailDemo().push({
          id,
          para: [...entrada.para],
          assunto: entrada.assunto,
          anexos: (entrada.anexos ?? []).map((a) => ({
            nomeArquivo: a.nomeArquivo,
            tipoConteudo: a.tipoConteudo,
            bytes: a.conteudo.byteLength,
          })),
          enviadoEm: new Date().toISOString(),
        });
        return { id };
      },
    };
  }
  const apiKey = process.env.RESEND_API_KEY;
  const de = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !de) throw new ErroIntegracaoNaoConfigurada("email");
  return {
    ambienteDeTeste: false,
    enviar: (entrada) => enviarEmail({ apiKey }, { ...entrada, de }),
  };
}

// --- NFS-e (P43) ----------------------------------------------------------------------------

export interface EmissorNfse extends AdaptadorNfse {
  /** Verdadeiro na demonstração: a nota não existe fora do sistema. */
  readonly ambienteDeTeste: boolean;
}

/**
 * Emissor da nota. Sem provedor configurado fora da demonstração, a chamada
 * falha com `ErroIntegracaoNaoConfigurada` e a nota segue pela emissão manual
 * assistida (PRD 14, T-05).
 */
export function obterEmissorNfse(): EmissorNfse {
  if (modoDados() === "demonstracao") {
    return {
      ambienteDeTeste: true,
      async emitir(entrada: EmissaoNfseEntrada): Promise<ResultadoNfse> {
        const { consumirFalhaProvedorDemo } =
          await import("@/lib/dados/demonstracao/nota");
        if (consumirFalhaProvedorDemo()) {
          return {
            estado: "erro",
            erro: "O provedor recusou a nota: o endereço de quem paga está incompleto. Confira o cadastro e envie de novo.",
            tentativas: 1,
          };
        }
        const sufixo = entrada.cobrancaId.replace(/-/g, "").slice(0, 8);
        return {
          estado: "emitida",
          providerRef: `demo-${sufixo}`,
          numero: `D${sufixo.toUpperCase()}`,
          tentativas: 1,
        };
      },
      async consultar(providerRef: string): Promise<ResultadoNfse> {
        return {
          estado: "emitida",
          providerRef,
          numero: `D${providerRef
            .replace(/[^0-9a-f]/gi, "")
            .slice(0, 8)
            .toUpperCase()}`,
          tentativas: 1,
        };
      },
      async cancelar(providerRef: string): Promise<ResultadoNfse> {
        return { estado: "cancelada", providerRef, tentativas: 1 };
      },
    };
  }
  const baseUrl = process.env.NFSE_PROVEDOR_BASE_URL?.trim();
  const apiKey = process.env.NFSE_PROVEDOR_API_KEY?.trim();
  if (!baseUrl || !apiKey) throw new ErroIntegracaoNaoConfigurada("nfse");
  const real = new EmissorNacionalAdaptador({
    baseUrl: baseUrl.replace(/\/+$/, ""),
    apiKey,
  });
  return {
    ambienteDeTeste: false,
    emitir: (e) => real.emitir(e),
    consultar: (r) => real.consultar(r),
    cancelar: (r, m) => real.cancelar(r, m),
  };
}
