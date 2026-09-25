import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { modoDados } from "@/lib/dados/modo";
import { decidirAcesso, precisaMfa } from "./acesso";
import { criarAutenticacaoDemonstracao } from "./demonstracao";
import { criarAutenticacaoSupabase } from "./supabase";
import type { ProvedorAutenticacao, SessaoUsuario } from "./tipos";

/**
 * Fábrica da autenticação do servidor. Escolhe a implementação pelo modo
 * (src/lib/dados/modo.ts): Supabase Auth em qualquer ambiente, seletor
 * fictício só em desenvolvimento com KZ_DADOS=demonstracao.
 */
export function obterAutenticacao(): ProvedorAutenticacao {
  return modoDados() === "demonstracao"
    ? criarAutenticacaoDemonstracao()
    : criarAutenticacaoSupabase();
}

/** Sessão da requisição atual, lida uma vez por renderização. */
export const obterSessao = cache(async (): Promise<SessaoUsuario | null> => {
  return obterAutenticacao().obterSessao();
});

/**
 * Para Server Components e Server Actions de tela logada: devolve a sessão
 * ou redireciona. É a segunda barreira depois do proxy: a sessão pode ter
 * sido revogada entre as duas leituras, e uma Server Action chega por POST
 * sem passar pela tela.
 *
 * - Sem `caminho` (layouts, que não sabem a rota): exige sessão, perfil
 *   ativo com papel e o AAL2 de quem precisa (PRD 13 e 21.2).
 * - Com `caminho` (página ou ação que sabe de onde é): aplica a mesma
 *   regra do proxy (decidirAcesso), inclusive o papel da rota. Use sempre
 *   que a tela ou a ação fizer algo que só alguns papéis podem.
 */
export async function exigirSessao(caminho?: string): Promise<SessaoUsuario> {
  const sessao = await obterSessao();
  if (!sessao) redirect("/entrar?aviso=sessao-encerrada");
  if (!sessao.ativo || sessao.papeis.length === 0)
    redirect("/sair?motivo=sem-acesso");

  if (caminho) {
    const decisao = decidirAcesso(caminho, sessao);
    if (decisao.tipo === "redirecionar") redirect(decisao.para);
    return sessao;
  }

  const mfa = precisaMfa(sessao);
  if (mfa) redirect(mfa);
  return sessao;
}
