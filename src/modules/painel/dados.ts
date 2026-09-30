import "server-only";
import type { SessaoUsuario } from "@/lib/auth/tipos";
import { ErroRepositorio } from "@/lib/dados/erros";
import { obterRepositorios } from "@/lib/dados/fabrica";
import type { PainelExecutivo } from "@/lib/dados/tipos-gestao";
import { somarMeses } from "@/lib/gestao/financeiro";

/**
 * Dados da tela do painel executivo (P52). Só a diretoria, em AAL2 (PRD 13).
 * Traz também o mês anterior, para cada número ter uma comparação (voz.md: nada
 * de número solto); se o mês anterior falhar, a tela segue sem comparar.
 */
export interface DadosPainel {
  atual: PainelExecutivo;
  anterior: PainelExecutivo | null;
}

export type TelaPainel =
  | { situacao: "mfa" }
  | { situacao: "sem_permissao" }
  | { situacao: "ok"; dados: DadosPainel };

export async function obterTelaPainel(
  usuario: SessaoUsuario,
  mes: string | null,
): Promise<TelaPainel> {
  if (usuario.aal !== "aal2") return { situacao: "mfa" };
  const { gestao } = await obterRepositorios();
  try {
    const atual = await gestao.painelExecutivo(mes);
    let anterior: PainelExecutivo | null = null;
    try {
      anterior = await gestao.painelExecutivo(somarMeses(atual.mes, -1));
    } catch {
      anterior = null;
    }
    return { situacao: "ok", dados: { atual, anterior } };
  } catch (erro) {
    if (erro instanceof ErroRepositorio && erro.codigo === "sem_permissao") {
      return { situacao: "sem_permissao" };
    }
    throw erro;
  }
}
