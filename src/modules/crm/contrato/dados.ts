import "server-only";
import type { SessaoUsuario } from "@/lib/auth/tipos";
import { ErroRepositorio } from "@/lib/dados/erros";
import { obterRepositorios } from "@/lib/dados/fabrica";
import { modoDados } from "@/lib/dados/modo";
import type { SituacaoContrato } from "@/lib/dados/tipos-contrato";

/**
 * Dados da tela do contrato (P31). O contrato mostra valores e leva dados
 * pessoais, então api.contrato_situacao exige AAL2 para todo papel; a tela
 * diz isso antes de pedir ao banco.
 */
export type TelaContrato =
  | { situacao: "mfa" }
  | { situacao: "sem_permissao" }
  | {
      situacao: "ok";
      contrato: SituacaoContrato;
      /** Botões de simulação (webhook da Autentique) só na demonstração. */
      demonstracao: boolean;
    };

export async function obterTelaContrato(
  familiaId: string,
  usuario: SessaoUsuario,
): Promise<TelaContrato> {
  if (usuario.aal !== "aal2") return { situacao: "mfa" };
  const { contratos } = await obterRepositorios();
  try {
    return {
      situacao: "ok",
      contrato: await contratos.obterSituacao(familiaId),
      demonstracao: modoDados() === "demonstracao",
    };
  } catch (erro) {
    if (erro instanceof ErroRepositorio && erro.codigo === "sem_permissao") {
      return { situacao: "sem_permissao" };
    }
    throw erro;
  }
}
