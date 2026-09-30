import "server-only";
import { ErroRepositorio } from "@/lib/dados/erros";
import { obterRepositorios } from "@/lib/dados/fabrica";
import type {
  ListaOcorrencias,
  OcorrenciaDetalhe,
  PessoaResponsavel,
  SituacaoOcorrencias,
} from "@/lib/dados/tipos-ocorrencia";

/**
 * Dados das telas de ocorrência (P42). O recorte por papel é do banco: a
 * coordenação e a diretoria veem todas, inclusive as privadas; a enfermeira só
 * as não privadas em que é responsável. A tela traduz "sem permissão" em uma
 * frase.
 */

export const SITUACOES_OCORRENCIA: readonly SituacaoOcorrencias[] = [
  "abertas",
  "fechadas",
  "todas",
];

export function situacaoDaBusca(
  valor: string | undefined,
): SituacaoOcorrencias {
  return SITUACOES_OCORRENCIA.find((s) => s === valor) ?? "abertas";
}

export type TelaListaOcorrencias =
  { situacao: "sem_permissao" } | { situacao: "ok"; lista: ListaOcorrencias };

export async function obterTelaListaOcorrencias(
  situacao: SituacaoOcorrencias,
  familiaId?: string,
): Promise<TelaListaOcorrencias> {
  const { ocorrencias } = await obterRepositorios();
  try {
    return {
      situacao: "ok",
      lista: await ocorrencias.listar(situacao, familiaId),
    };
  } catch (erro) {
    if (erro instanceof ErroRepositorio && erro.codigo === "sem_permissao") {
      return { situacao: "sem_permissao" };
    }
    throw erro;
  }
}

export type TelaOcorrencia =
  | { situacao: "sem_permissao" }
  | { situacao: "nao_encontrada" }
  | {
      situacao: "ok";
      ocorrencia: OcorrenciaDetalhe;
      responsaveis: PessoaResponsavel[];
    };

export async function obterTelaOcorrencia(id: string): Promise<TelaOcorrencia> {
  const { ocorrencias } = await obterRepositorios();
  try {
    const ocorrencia = await ocorrencias.obter(id);
    // A lista de responsáveis é da coordenação e da diretoria; a enfermeira não a lê.
    const responsaveis = ocorrencia.podeGerir
      ? await ocorrencias.responsaveis()
      : [];
    return { situacao: "ok", ocorrencia, responsaveis };
  } catch (erro) {
    if (erro instanceof ErroRepositorio) {
      if (erro.codigo === "sem_permissao") return { situacao: "sem_permissao" };
      if (
        erro.codigo === "nao_encontrado" ||
        /ocorrencia:inexistente/.test(erro.message)
      ) {
        return { situacao: "nao_encontrada" };
      }
    }
    throw erro;
  }
}
