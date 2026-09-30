import "server-only";
import { ErroRepositorio } from "@/lib/dados/erros";
import { obterRepositorios } from "@/lib/dados/fabrica";
import type { ListaPosVenda } from "@/lib/dados/tipos-ocorrencia";

/** Dados da tela do pós-venda, pipeline 4 (P42). Coordenação e diretoria, AAL2, conferido no banco. */
export type TelaPosVenda =
  { situacao: "sem_permissao" } | { situacao: "ok"; lista: ListaPosVenda };

export function situacaoPosVenda(
  valor: string | undefined,
): "abertos" | "todos" {
  return valor === "todos" ? "todos" : "abertos";
}

export async function obterTelaPosVenda(
  situacao: "abertos" | "todos",
): Promise<TelaPosVenda> {
  const { posVenda } = await obterRepositorios();
  try {
    return { situacao: "ok", lista: await posVenda.listar(situacao) };
  } catch (erro) {
    if (erro instanceof ErroRepositorio && erro.codigo === "sem_permissao") {
      return { situacao: "sem_permissao" };
    }
    throw erro;
  }
}
