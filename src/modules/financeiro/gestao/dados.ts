import "server-only";
import type { SessaoUsuario } from "@/lib/auth/tipos";
import { ErroRepositorio } from "@/lib/dados/erros";
import { obterRepositorios } from "@/lib/dados/fabrica";
import type {
  Dre,
  ExtratoVisao,
  Inadimplencia,
  Lancamentos,
  ListaDespesas,
  PagamentosEquipe,
  PrevisaoRecebimentos,
} from "@/lib/dados/tipos-gestao";

/**
 * Dados das telas do financeiro da Fase 3 (P46). Financeiro e diretoria,
 * sempre em AAL2 (PRD 13). A tela diz isso antes de pedir ao banco, que
 * confere de novo.
 */
export type TelaGestao<T> =
  | { situacao: "mfa" }
  | { situacao: "sem_permissao" }
  | { situacao: "ok"; dados: T };

async function comAcesso<T>(
  usuario: SessaoUsuario,
  ler: () => Promise<T>,
): Promise<TelaGestao<T>> {
  if (usuario.aal !== "aal2") return { situacao: "mfa" };
  try {
    return { situacao: "ok", dados: await ler() };
  } catch (erro) {
    if (erro instanceof ErroRepositorio && erro.codigo === "sem_permissao") {
      return { situacao: "sem_permissao" };
    }
    throw erro;
  }
}

export interface VisaoFinanceira {
  dre: Dre;
  lancamentos: Lancamentos;
  inadimplencia: Inadimplencia;
  previsao: PrevisaoRecebimentos;
}

export function obterTelaVisaoFinanceira(
  usuario: SessaoUsuario,
  mes: string | null,
) {
  return comAcesso<VisaoFinanceira>(usuario, async () => {
    const { gestao } = await obterRepositorios();
    const [dre, lancamentos, inadimplencia, previsao] = await Promise.all([
      gestao.dre(mes),
      gestao.lancamentos(mes),
      gestao.inadimplencia(),
      gestao.previsaoRecebimentos(),
    ]);
    return { dre, lancamentos, inadimplencia, previsao };
  });
}

export function obterTelaDespesas(usuario: SessaoUsuario, mes: string | null) {
  return comAcesso<ListaDespesas>(usuario, async () => {
    const { gestao } = await obterRepositorios();
    return gestao.despesas(mes);
  });
}

export function obterTelaEquipe(usuario: SessaoUsuario, mes: string | null) {
  return comAcesso<PagamentosEquipe>(usuario, async () => {
    const { gestao } = await obterRepositorios();
    return gestao.pagamentosEquipe(mes);
  });
}

export function obterTelaExtrato(
  usuario: SessaoUsuario,
  importacaoId: string | null,
) {
  return comAcesso<ExtratoVisao>(usuario, async () => {
    const { gestao } = await obterRepositorios();
    return gestao.extrato(importacaoId);
  });
}
