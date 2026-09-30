import "server-only";
import { cookies } from "next/headers";
import { modoDados } from "@/lib/dados/modo";
import { criarClienteServidor } from "@/lib/db/cliente-servidor";

/**
 * Sessão da família no portal (P49). A conta da família é um usuário do
 * Supabase Auth sem perfil e sem papel: o link mágico do e-mail abre a
 * sessão, e quem decide o que ela vê é a função api.portal_familia, com a
 * RLS do banco. Nada aqui passa pelo proxy da equipe (rotas /familia ficam
 * abertas em acesso.ts) nem dá acesso a tela da equipe.
 *
 * Na demonstração (só em desenvolvimento, src/lib/dados/modo.ts) não há
 * Supabase Auth: a sessão é um cookie com o id da pessoa fictícia.
 */
export const COOKIE_FAMILIA_DEMONSTRACAO = "kz_demo_familia";

const OPCOES_COOKIE = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: false,
};

/** Pessoa da sessão de demonstração; null fora dela ou sem cookie. */
export async function pessoaDaSessaoDemonstracao(): Promise<string | null> {
  if (modoDados() !== "demonstracao") return null;
  const valor = (await cookies()).get(COOKIE_FAMILIA_DEMONSTRACAO)?.value;
  return valor && /^[0-9a-f-]{36}$/.test(valor) ? valor : null;
}

export async function abrirSessaoDemonstracao(pessoaId: string): Promise<void> {
  if (modoDados() !== "demonstracao") return;
  (await cookies()).set(COOKIE_FAMILIA_DEMONSTRACAO, pessoaId, OPCOES_COOKIE);
}

/** Confere o link do e-mail no Supabase Auth e devolve a conta que abriu. */
export async function verificarLinkDaFamilia(
  tokenHash: string,
): Promise<{ ok: true; email: string; usuarioId: string } | { ok: false }> {
  try {
    const cliente = await criarClienteServidor();
    const { data, error } = await cliente.auth.verifyOtp({
      token_hash: tokenHash,
      type: "email",
    });
    const email = data.user?.email;
    if (error || !data.user || !email) return { ok: false };
    return { ok: true, email, usuarioId: data.user.id };
  } catch {
    return { ok: false };
  }
}

/** Pede ao Supabase Auth o link mágico (o e-mail é do Supabase Auth; o app não envia e-mail). */
export async function pedirLinkMagicoDaFamilia(
  email: string,
): Promise<boolean> {
  try {
    const cliente = await criarClienteServidor();
    const { error } = await cliente.auth.signInWithOtp({ email });
    return !error;
  } catch {
    return false;
  }
}

/** Encerra a sessão da família (cookie de demonstração ou sessão do Supabase Auth). */
export async function encerrarSessaoDaFamilia(): Promise<void> {
  if (modoDados() === "demonstracao") {
    (await cookies()).delete(COOKIE_FAMILIA_DEMONSTRACAO);
    return;
  }
  try {
    const cliente = await criarClienteServidor();
    await cliente.auth.signOut();
  } catch {
    // Sem sessão para encerrar.
  }
}
