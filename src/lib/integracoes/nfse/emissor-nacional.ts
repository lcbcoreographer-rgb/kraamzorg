import "server-only";
import { DESCRICAO_SERVICO_NFSE } from "./descricao";
import type {
  AdaptadorNfse,
  EmissaoNfseEntrada,
  EstadoNotaFiscal,
  ResultadoNfse,
} from "./tipos";

/**
 * Implementação para o provedor com suporte ao Emissor Nacional / ADN, que
 * o PRD 14 aponta como padrão a partir de 01/11/2026 (T-05, 22.1). O
 * provedor comercial exato (quem assina o certificado A1 em nome da
 * Kraamzorg e expõe essa API REST) está **[confirmar]**: a Kraamzorg nunca
 * emitiu A1 e a contadora ainda vai indicar o parceiro. Esta classe assume
 * um gateway REST-sobre-o-padrão-nacional (`baseUrl` + `apiKey`
 * configuráveis, do jeito que provedores como os citados na pesquisa desta
 * sessão costumam expor), não a API mTLS bruta do governo. Reconfira os
 * campos marcados [conferir] contra a documentação do provedor escolhido
 * antes de homologar (T-05).
 *
 * Nunca chama a rede real em teste: `fetchImpl` é interceptado, e
 * `esperarImpl` substitui a espera real entre tentativas (CLAUDE.md,
 * "integração com terceiro testada com respostas simuladas").
 */

export interface OpcoesEmissorNacional {
  baseUrl: string;
  apiKey: string;
  fetchImpl?: typeof fetch;
  /** Novas tentativas (P43 item 3) para falha transitória de rede ou HTTP
   * 5xx. Erro de validação (4xx) nunca tenta de novo. Padrão: 3. */
  tentativasMaximas?: number;
  /** Espera entre tentativas; padrão usa espera real crescente. Testes
   * injetam uma função instantânea para não esperar de verdade. */
  esperarImpl?: (tentativa: number) => Promise<void>;
}

function esperaPadrao(tentativa: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, tentativa * 500));
}

interface RespostaEmissaoBruta {
  // [conferir] nomes de campo exatos do provedor escolhido.
  status?: string;
  provider_ref?: string;
  numero?: string;
  pdf_url?: string;
  xml_url?: string;
  erro?: string;
}

/** HTTP 4xx é erro do pedido (não tenta de novo); 5xx e falha de rede são
 * transitórios (tentam de novo). */
class ErroTransitorioNfse extends Error {}
class ErroPermanenteNfse extends Error {}

function mapearEstado(status: string | undefined): EstadoNotaFiscal {
  switch (status) {
    case "emitida":
    case "autorizada":
    case "authorized":
      return "emitida";
    case "processando":
    case "processing":
      return "processando";
    case "cancelada":
    case "cancelled":
    case "canceled":
      return "cancelada";
    case "erro":
    case "rejeitada":
    case "rejected":
      return "erro";
    default:
      return "pendente";
  }
}

export class EmissorNacionalAdaptador implements AdaptadorNfse {
  constructor(private readonly opcoes: OpcoesEmissorNacional) {}

  private async requisitar(
    caminho: string,
    corpo: Record<string, unknown>,
  ): Promise<RespostaEmissaoBruta> {
    const fetchImpl = this.opcoes.fetchImpl ?? fetch;
    let resposta: Response;
    try {
      resposta = await fetchImpl(`${this.opcoes.baseUrl}${caminho}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.opcoes.apiKey}`,
        },
        body: JSON.stringify(corpo),
      });
    } catch (erroRede) {
      throw new ErroTransitorioNfse(
        erroRede instanceof Error ? erroRede.message : "falha de rede",
      );
    }

    if (!resposta.ok) {
      const mensagem = `NFS-e: resposta HTTP ${resposta.status} em ${caminho}`;
      if (resposta.status >= 500) throw new ErroTransitorioNfse(mensagem);
      throw new ErroPermanenteNfse(mensagem);
    }

    return (await resposta.json()) as RespostaEmissaoBruta;
  }

  private async comNovasTentativas(
    executar: () => Promise<RespostaEmissaoBruta>,
  ): Promise<ResultadoNfse> {
    const tentativasMaximas = this.opcoes.tentativasMaximas ?? 3;
    const esperar = this.opcoes.esperarImpl ?? esperaPadrao;
    let ultimoErro: unknown;

    for (let tentativa = 1; tentativa <= tentativasMaximas; tentativa++) {
      try {
        const bruta = await executar();
        return {
          estado: mapearEstado(bruta.status),
          providerRef: bruta.provider_ref,
          numero: bruta.numero,
          pdfUrl: bruta.pdf_url,
          xmlUrl: bruta.xml_url,
          erro: bruta.erro,
          tentativas: tentativa,
        };
      } catch (erro) {
        ultimoErro = erro;
        if (erro instanceof ErroPermanenteNfse) break;
        if (tentativa < tentativasMaximas) await esperar(tentativa);
      }
    }

    return {
      estado: "erro",
      erro:
        ultimoErro instanceof Error ? ultimoErro.message : "erro desconhecido",
      tentativas:
        ultimoErro instanceof ErroPermanenteNfse
          ? 1
          : (this.opcoes.tentativasMaximas ?? 3),
    };
  }

  async emitir(entrada: EmissaoNfseEntrada): Promise<ResultadoNfse> {
    return this.comNovasTentativas(() =>
      this.requisitar("/dps", {
        referencia_externa: entrada.cobrancaId,
        tomador: {
          nome: entrada.tomador.nome,
          cpf_cnpj: entrada.tomador.cpfCnpj,
          email: entrada.tomador.email,
          endereco: entrada.tomador.endereco
            ? {
                logradouro: entrada.tomador.endereco.logradouro,
                numero: entrada.tomador.endereco.numero,
                bairro: entrada.tomador.endereco.bairro,
                municipio_codigo_ibge:
                  entrada.tomador.endereco.municipioCodigoIbge,
                uf: entrada.tomador.endereco.uf,
                cep: entrada.tomador.endereco.cep,
              }
            : undefined,
        },
        valor_centavos: entrada.valorCentavos,
        codigo_servico: entrada.codigoServico,
        // Fixa, sempre a mesma: nenhum parâmetro de entrada a sobrescreve.
        descricao: DESCRICAO_SERVICO_NFSE,
      }),
    );
  }

  async consultar(providerRef: string): Promise<ResultadoNfse> {
    return this.comNovasTentativas(() =>
      this.requisitar(`/dps/${providerRef}/consulta`, {}),
    );
  }

  async cancelar(providerRef: string, motivo: string): Promise<ResultadoNfse> {
    return this.comNovasTentativas(() =>
      this.requisitar(`/dps/${providerRef}/cancelar`, { motivo }),
    );
  }
}
