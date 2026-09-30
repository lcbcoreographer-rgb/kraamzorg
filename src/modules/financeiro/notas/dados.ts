import "server-only";
import type { SessaoUsuario } from "@/lib/auth/tipos";
import { ErroRepositorio } from "@/lib/dados/erros";
import { obterRepositorios } from "@/lib/dados/fabrica";
import { modoDados } from "@/lib/dados/modo";
import type {
  EstadoNota,
  ListaNotas,
  NotaDetalhe,
} from "@/lib/dados/tipos-nota";

/**
 * Dados das telas de nota fiscal (P43). Nota mostra valor, pagador e
 * documento fiscal: só financeiro e diretoria, sempre em AAL2 (PRD 13). A tela
 * diz isso antes de pedir ao banco, que confere de novo.
 */
export type TelaListaNotas =
  | { situacao: "mfa" }
  | { situacao: "sem_permissao" }
  | { situacao: "ok"; lista: ListaNotas };

export type TelaNota =
  | { situacao: "mfa" }
  | { situacao: "sem_permissao" }
  | { situacao: "nao_encontrada" }
  | { situacao: "ok"; nota: NotaDetalhe; demonstracao: boolean };

export async function obterTelaListaNotas(
  usuario: SessaoUsuario,
  estado?: EstadoNota,
): Promise<TelaListaNotas> {
  if (usuario.aal !== "aal2") return { situacao: "mfa" };
  const { notas } = await obterRepositorios();
  try {
    return { situacao: "ok", lista: await notas.listar(estado) };
  } catch (erro) {
    if (erro instanceof ErroRepositorio && erro.codigo === "sem_permissao") {
      return { situacao: "sem_permissao" };
    }
    throw erro;
  }
}

export async function obterTelaNota(
  usuario: SessaoUsuario,
  id: string,
): Promise<TelaNota> {
  if (usuario.aal !== "aal2") return { situacao: "mfa" };
  const { notas } = await obterRepositorios();
  try {
    return {
      situacao: "ok",
      nota: await notas.obter(id),
      demonstracao: modoDados() === "demonstracao",
    };
  } catch (erro) {
    if (erro instanceof ErroRepositorio) {
      if (erro.codigo === "sem_permissao") return { situacao: "sem_permissao" };
      if (
        erro.codigo === "nao_encontrado" ||
        /nota:inexistente/.test(erro.message)
      ) {
        return { situacao: "nao_encontrada" };
      }
    }
    throw erro;
  }
}
