import type { ClienteServidor } from "@/lib/db/cliente-servidor";
import { ehPapel } from "./papeis";
import type { NivelAutenticacao, SessaoBorda, SessaoUsuario } from "./tipos";

/**
 * Lê a sessão por um cliente já montado (Server Component ou proxy):
 * claims verificadas do JWT, perfil e papéis pela RLS (a pessoa lê a
 * própria linha mesmo em AAL1, ADR 0002) e o nível que o MFA permite.
 */
export async function lerSessaoSupabase(cliente: ClienteServidor): Promise<SessaoUsuario | null> {
  const { data, error } = await cliente.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  const usuarioId = data.claims.sub;
  const aal: NivelAutenticacao = data.claims.aal === "aal2" ? "aal2" : "aal1";

  const [perfil, papeis, nivel] = await Promise.all([
    cliente.from("perfil").select("nome, email, ativo").eq("id", usuarioId).maybeSingle(),
    cliente.from("usuario_papel").select("papel").eq("usuario_id", usuarioId),
    cliente.auth.mfa.getAuthenticatorAssuranceLevel(),
  ]);

  return {
    usuarioId,
    nome: perfil.data?.nome ?? "",
    email: perfil.data?.email ?? (typeof data.claims.email === "string" ? data.claims.email : ""),
    ativo: perfil.data?.ativo ?? false,
    papeis: (papeis.data ?? []).map((l) => l.papel).filter(ehPapel),
    aal,
    aalPossivel: nivel.data?.nextLevel === "aal2" ? "aal2" : aal,
  };
}

export async function sessaoBordaSupabase(cliente: ClienteServidor): Promise<SessaoBorda | null> {
  const sessao = await lerSessaoSupabase(cliente);
  if (!sessao) return null;
  const { usuarioId, papeis, ativo, aal, aalPossivel } = sessao;
  return { usuarioId, papeis, ativo, aal, aalPossivel };
}

