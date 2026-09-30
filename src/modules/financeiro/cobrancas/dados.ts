import "server-only";
import type { SessaoUsuario } from "@/lib/auth/tipos";
import { ErroRepositorio } from "@/lib/dados/erros";
import { obterRepositorios } from "@/lib/dados/fabrica";
import { modoDados } from "@/lib/dados/modo";
import type {
  CobrancaDetalhe,
  ListaCobrancas,
  SituacaoCobranca,
} from "@/lib/dados/tipos-contrato";

/**
 * Dados das telas de cobrança (P32). Cobrança é tabela financeira: só
 * financeiro e diretoria, sempre em AAL2 (PRD 13). A tela diz isso antes de
 * pedir ao banco, que confere de novo.
 */
export type TelaListaCobrancas =
  | { situacao: "mfa" }
  | { situacao: "sem_permissao" }
  | { situacao: "ok"; lista: ListaCobrancas };

export type TelaDetalheCobranca =
  | { situacao: "mfa" }
  | { situacao: "sem_permissao" }
  | { situacao: "nao_encontrada" }
  | { situacao: "ok"; cobranca: CobrancaDetalhe; demonstracao: boolean };

export const SITUACOES: readonly SituacaoCobranca[] = [
  "aberta",
  "vencida",
  "paga",
];

export function situacaoDaBusca(valor: string | undefined) {
  return SITUACOES.find((s) => s === valor);
}

export async function obterTelaListaCobrancas(
  usuario: SessaoUsuario,
  situacao?: SituacaoCobranca,
): Promise<TelaListaCobrancas> {
  if (usuario.aal !== "aal2") return { situacao: "mfa" };
  const { cobrancas } = await obterRepositorios();
  try {
    return { situacao: "ok", lista: await cobrancas.listar(situacao) };
  } catch (erro) {
    if (erro instanceof ErroRepositorio && erro.codigo === "sem_permissao") {
      return { situacao: "sem_permissao" };
    }
    throw erro;
  }
}

export async function obterTelaDetalheCobranca(
  usuario: SessaoUsuario,
  id: string,
): Promise<TelaDetalheCobranca> {
  if (usuario.aal !== "aal2") return { situacao: "mfa" };
  const { cobrancas } = await obterRepositorios();
  try {
    return {
      situacao: "ok",
      cobranca: await cobrancas.obter(id),
      demonstracao: modoDados() === "demonstracao",
    };
  } catch (erro) {
    if (erro instanceof ErroRepositorio) {
      if (erro.codigo === "sem_permissao") return { situacao: "sem_permissao" };
      if (
        erro.codigo === "nao_encontrado" ||
        /cobranca_inexistente/.test(erro.message)
      ) {
        return { situacao: "nao_encontrada" };
      }
    }
    throw erro;
  }
}
