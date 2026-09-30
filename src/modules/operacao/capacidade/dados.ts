import "server-only";
import type { SessaoUsuario } from "@/lib/auth/tipos";
import { ErroRepositorio } from "@/lib/dados/erros";
import { obterRepositorios } from "@/lib/dados/fabrica";
import type { CapacidadeVisao } from "@/lib/dados/tipos-gestao";

/**
 * Dados da tela de capacidade (P45). A capacidade é da coordenação e da
 * diretoria, sempre em AAL2 (PRD 13). A tela diz isso antes de pedir ao
 * banco, que confere de novo.
 */
export type TelaCapacidade =
  | { situacao: "mfa" }
  | { situacao: "sem_permissao" }
  | { situacao: "ok"; visao: CapacidadeVisao };

export async function obterTelaCapacidade(
  usuario: SessaoUsuario,
): Promise<TelaCapacidade> {
  if (usuario.aal !== "aal2") return { situacao: "mfa" };
  const { gestao } = await obterRepositorios();
  try {
    return { situacao: "ok", visao: await gestao.capacidade() };
  } catch (erro) {
    if (erro instanceof ErroRepositorio && erro.codigo === "sem_permissao") {
      return { situacao: "sem_permissao" };
    }
    throw erro;
  }
}
