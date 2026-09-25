import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { modoDados } from "@/lib/dados/modo";
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
 * ou manda para /entrar. É a segunda barreira depois do proxy (a sessão
 * pode ter sido revogada entre as duas leituras).
 */
export async function exigirSessao(): Promise<SessaoUsuario> {
  const sessao = await obterSessao();
  if (!sessao) redirect("/entrar?aviso=sessao-encerrada");
  return sessao;
}
