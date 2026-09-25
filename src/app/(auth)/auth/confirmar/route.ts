import { NextResponse, type NextRequest } from "next/server";
import { obterAutenticacao } from "@/lib/auth/sessao";

/**
 * Destino dos links de e-mail do Supabase Auth (convite e recuperação de
 * senha). O modelo do e-mail aponta para
 * `{{ .SiteURL }}/auth/confirmar?token_hash={{ .TokenHash }}&type=invite`
 * (ou `type=recovery`), configurado no painel do Supabase Auth (pendência
 * registrada em docs/sessoes/P07-app.md). Conferido o link, a sessão abre e
 * a pessoa cria a senha.
 */
export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const tipo = request.nextUrl.searchParams.get("type");
  const destino = (caminho: string) =>
    NextResponse.redirect(new URL(caminho, request.url));

  if (!tokenHash || (tipo !== "invite" && tipo !== "recovery")) {
    return destino("/entrar?aviso=link-invalido");
  }
  const resultado = await obterAutenticacao().confirmarLinkEmail(
    tokenHash,
    tipo,
  );
  return resultado.ok
    ? destino("/definir-senha")
    : destino("/entrar?aviso=link-invalido");
}
