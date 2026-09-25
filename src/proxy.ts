import type { NextRequest } from "next/server";
import { decidirAcesso } from "@/lib/auth/acesso";
import { lerSessaoNaBorda, redirecionarComCookies } from "@/lib/auth/borda";

/**
 * Proxy do Next 16 (o antigo middleware, node_modules/next/dist/docs,
 * file-conventions/proxy.md). Roda antes de cada tela: renova a sessão do
 * Supabase, exige sessão, leva perfil com MFA obrigatório ao desafio
 * (AAL2, PRD 13 e 21.2) e mantém cada papel dentro da própria navegação
 * (src/lib/navegacao). A regra está em src/lib/auth/acesso.ts.
 */
export async function proxy(request: NextRequest) {
  const { sessao, resposta } = await lerSessaoNaBorda(request);
  const decisao = decidirAcesso(request.nextUrl.pathname, sessao);
  if (decisao.tipo === "redirecionar") {
    return redirecionarComCookies(request, resposta, decisao.para);
  }
  return resposta;
}

export const config = {
  matcher: [
    // Tudo, menos arquivos estáticos, imagens, a marca e as rotas de API
    // (webhooks e cron têm autenticação própria, PRD 14).
    "/((?!_next/static|_next/image|favicon.ico|brand/|api/|.*\\.(?:png|svg|ico|webp|woff2)$).*)",
  ],
};
