import type { DadosLinkPagamento } from "@/lib/dados/tipos-contrato";

/**
 * Pede à InfinitePay o link de cada cobrança sem link e o guarda no banco
 * (P32 item 1). Usado por três caminhos com as mesmas regras: o webhook da
 * Autentique (logo depois da assinatura, com o cliente de serviço), a tela
 * da cobrança (financeiro, "Gerar o link") e a demonstração.
 *
 * Nunca lança: um link que não sai não pode derrubar o webhook (o contrato
 * já está assinado e a Autentique não deve reenviar por causa disso). O que
 * falhou fica registrado como aviso ao financeiro, que gera o link de novo
 * na tela da cobrança.
 */
export interface DependenciasLinks {
  criarLink(dados: DadosLinkPagamento): Promise<{
    url: string;
    slug: string | null;
  }>;
  registrar(
    cobrancaId: string,
    url: string,
    slug: string | null,
  ): Promise<void>;
  avisarFalha(
    cobrancaId: string,
    motivo: "acima_do_limite" | "falha_integracao",
  ): Promise<void>;
}

export interface ResultadoLinks {
  criados: string[];
  acimaDoLimite: string[];
  falhas: string[];
}

export async function gerarLinksPendentes(
  pendentes: DadosLinkPagamento[],
  deps: DependenciasLinks,
): Promise<ResultadoLinks> {
  const resultado: ResultadoLinks = {
    criados: [],
    acimaDoLimite: [],
    falhas: [],
  };
  for (const dados of pendentes) {
    // Parcelamento acima do limite do pacote (exceção aprovada, C-05): o
    // link não sai nem é pedido, e o financeiro combina a cobrança à mão.
    if (dados.acimaDoLimite || dados.parcelas > dados.parcelasMax) {
      resultado.acimaDoLimite.push(dados.cobrancaId);
      await deps
        .avisarFalha(dados.cobrancaId, "acima_do_limite")
        .catch(() => undefined);
      continue;
    }
    try {
      const link = await deps.criarLink(dados);
      await deps.registrar(dados.cobrancaId, link.url, link.slug);
      resultado.criados.push(dados.cobrancaId);
    } catch {
      resultado.falhas.push(dados.cobrancaId);
      await deps
        .avisarFalha(dados.cobrancaId, "falha_integracao")
        .catch(() => undefined);
    }
  }
  return resultado;
}
