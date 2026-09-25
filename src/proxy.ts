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
    // Tudo, menos os arquivos do Next, a marca, o favicon e as rotas de API
    // (webhooks e cron têm autenticação própria, PRD 14). Sem exceção por
    // extensão (.png, .svg): com ela, /familias/qualquer.png abria a rota
    // dinâmica /familias/[id] sem passar pelo proxy. Arquivo novo em
    // public/ que precise abrir sem sessão entra aqui pelo caminho exato.
    "/((?!_next/|__nextjs|favicon\\.ico$|brand/|api/).*)",
  ],
};
