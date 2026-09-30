import "server-only";
import { caminhoNota, tipoDoArquivoNota } from "@/lib/armazenamento/caminhos";
import type { ArmazenamentoPrivado } from "@/lib/armazenamento/tipos";
import type {
  DadosEmissaoNota,
  ResultadoNotaRegistro,
} from "@/lib/dados/tipos-nota";
import type { AdaptadorNfse, ResultadoNfse } from "./tipos";

/**
 * Do pedido de emissão ao registro no banco (P43), o mesmo caminho para a
 * emissão pela tela do financeiro e para a automática depois do pagamento:
 * o adaptador emite (com as novas tentativas dele), os arquivos que o
 * provedor devolve vão para o storage privado com nome por id, e o resultado
 * volta ao banco. Erro do provedor nunca se perde: vira o motivo que a tela
 * mostra, e a nota fica em `erro` para reenviar.
 */

/** Limite de tamanho do arquivo da nota (o mesmo do bucket privado). */
export const LIMITE_ARQUIVO_NOTA_BYTES = 4 * 1024 * 1024;

export interface DependenciasEmissao {
  emissor: AdaptadorNfse;
  armazenamento: Pick<ArmazenamentoPrivado, "salvar">;
  /** Grava o resultado no banco (pela tela ou pelo servidor de webhook). */
  registrar(resultado: ResultadoNotaRegistro): Promise<unknown>;
  baixar?: typeof fetch;
}

export interface ResultadoEmissao {
  estado: "emitida" | "erro" | "processando";
  numero: string | null;
  erro: string | null;
  tentativas: number;
}

/** Só https e fora de endereço interno: o servidor não segue link do provedor para dentro da rede. */
export function urlDeArquivoAceita(valor: string): boolean {
  let url: URL;
  try {
    url = new URL(valor);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  const host = url.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".internal")
  ) {
    return false;
  }
  if (host.startsWith("[") || host.includes(":")) return false;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return false;
  return true;
}

async function guardarArquivo(
  notaId: string,
  url: string | undefined,
  tipo: "pdf" | "xml",
  deps: DependenciasEmissao,
): Promise<string | null> {
  if (!url || !urlDeArquivoAceita(url)) return null;
  try {
    const resposta = await (deps.baixar ?? fetch)(url, { redirect: "error" });
    if (!resposta.ok) return null;
    const bytes = new Uint8Array(await resposta.arrayBuffer());
    if (
      bytes.byteLength === 0 ||
      bytes.byteLength > LIMITE_ARQUIVO_NOTA_BYTES
    ) {
      return null;
    }
    const achado = tipoDoArquivoNota(bytes);
    if (!achado || achado.extensao !== tipo) return null;
    const caminho = caminhoNota(notaId, tipo);
    await deps.armazenamento.salvar(caminho, bytes, achado.contentType, true);
    return caminho;
  } catch {
    // O número da nota vale mais que o arquivo: a tela avisa que falta o PDF.
    return null;
  }
}

export async function paraRegistro(
  notaId: string,
  resultado: ResultadoNfse,
  deps: DependenciasEmissao,
): Promise<ResultadoNotaRegistro> {
  if (resultado.estado === "emitida") {
    if (!resultado.numero?.trim()) {
      return {
        estado: "erro",
        providerRef: resultado.providerRef ?? null,
        erro: "O provedor confirmou a nota sem informar o número. Consulte a nota no portal do provedor.",
      };
    }
    const [pdfPath, xmlPath] = await Promise.all([
      guardarArquivo(notaId, resultado.pdfUrl, "pdf", deps),
      guardarArquivo(notaId, resultado.xmlUrl, "xml", deps),
    ]);
    return {
      estado: "emitida",
      providerRef: resultado.providerRef ?? null,
      numero: resultado.numero.trim(),
      pdfPath,
      xmlPath,
    };
  }
  if (resultado.estado === "processando" || resultado.estado === "pendente") {
    return {
      estado: "processando",
      providerRef: resultado.providerRef ?? null,
    };
  }
  return {
    estado: "erro",
    providerRef: resultado.providerRef ?? null,
    erro:
      resultado.erro?.trim() ||
      "O provedor recusou a nota sem explicar o motivo.",
  };
}

function resumir(
  registro: ResultadoNotaRegistro,
  tentativas: number,
): ResultadoEmissao {
  return {
    estado: registro.estado,
    numero: registro.numero ?? null,
    erro: registro.erro ?? null,
    tentativas,
  };
}

/** Emite a nota já em "processando" (o banco marcou antes) e registra o que voltou. */
export async function emitirNota(
  dados: DadosEmissaoNota,
  deps: DependenciasEmissao,
): Promise<ResultadoEmissao> {
  let resultado: ResultadoNfse;
  try {
    resultado = await deps.emissor.emitir({
      cobrancaId: dados.cobrancaId,
      valorCentavos: dados.valorCentavos,
      codigoServico: dados.codigoServico,
      descricaoServico: dados.descricaoServico,
      tomador: {
        nome: dados.tomador.nome,
        cpfCnpj: dados.tomador.cpf,
        email: dados.tomador.email ?? undefined,
        endereco: dados.tomador.endereco
          ? {
              logradouro: dados.tomador.endereco.logradouro,
              numero: dados.tomador.endereco.numero,
              bairro: dados.tomador.endereco.bairro,
              municipioCodigoIbge: dados.tomador.endereco.municipioCodigoIbge,
              uf: dados.tomador.endereco.uf,
              cep: dados.tomador.endereco.cep,
            }
          : undefined,
      },
    });
  } catch {
    resultado = {
      estado: "erro",
      erro: "Não deu para falar com o provedor da nota agora. Tente de novo em alguns minutos.",
      tentativas: 1,
    };
  }
  const registro = await paraRegistro(dados.notaId, resultado, deps);
  await deps.registrar(registro);
  return resumir(registro, resultado.tentativas);
}

/** Pergunta ao provedor como está uma nota em processamento e registra a resposta. */
export async function consultarNota(
  notaId: string,
  providerRef: string,
  deps: DependenciasEmissao,
): Promise<ResultadoEmissao> {
  let resultado: ResultadoNfse;
  try {
    resultado = await deps.emissor.consultar(providerRef);
  } catch {
    resultado = {
      estado: "processando",
      providerRef,
      tentativas: 1,
    };
  }
  const registro = await paraRegistro(notaId, resultado, deps);
  await deps.registrar({
    ...registro,
    providerRef: registro.providerRef ?? providerRef,
  });
  return resumir(registro, resultado.tentativas);
}
