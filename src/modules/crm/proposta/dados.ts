import "server-only";
import type { SessaoUsuario } from "@/lib/auth/tipos";
import { ErroRepositorio } from "@/lib/dados/erros";
import { obterRepositorios } from "@/lib/dados/fabrica";
import type { Proposta } from "@/lib/dados/tipos-venda";

/**
 * Dados da tela de proposta (P30 item 1). A proposta mostra valores e o
 * contrato, então api.proposta exige AAL2 para todo papel; a tela diz isso
 * antes de pedir ao banco.
 */
export type TelaProposta =
  | { situacao: "sem_oportunidade" }
  | { situacao: "mfa" }
  | { situacao: "sem_permissao" }
  | { situacao: "ok"; proposta: Proposta };

export async function obterTelaProposta(
  familiaId: string,
  usuario: SessaoUsuario,
): Promise<TelaProposta> {
  if (usuario.aal !== "aal2") return { situacao: "mfa" };
  const { venda } = await obterRepositorios();
  const oportunidadeId = await venda.oportunidadeDaFamilia(familiaId);
  if (!oportunidadeId) return { situacao: "sem_oportunidade" };
  try {
    return {
      situacao: "ok",
      proposta: await venda.obterProposta(oportunidadeId),
    };
  } catch (erro) {
    if (erro instanceof ErroRepositorio && erro.codigo === "sem_permissao") {
      return { situacao: "sem_permissao" };
    }
    throw erro;
  }
}
