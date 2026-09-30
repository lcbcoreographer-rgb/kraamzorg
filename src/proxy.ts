import type { NextRequest, NextResponse } from "next/server";
import { decidirAcesso } from "@/lib/auth/acesso";
import { lerSessaoNaBorda, redirecionarComCookies } from "@/lib/auth/borda";
import { gerarNonce, montarCsp } from "@/lib/seguranca/cabecalhos";

/**
 * Proxy do Next 16 (o antigo middleware, node_modules/next/dist/docs,
 * file-conventions/proxy.md). Roda antes de cada tela: renova a sessão do
 * Supabase, exige sessão, leva perfil com MFA obrigatório ao desafio
 * (AAL2, PRD 13 e 21.2) e mantém cada papel dentro da própria navegação
 * (src/lib/navegacao). A regra está em src/lib/auth/acesso.ts.
 *
 * Também monta a CSP com nonce novo por requisição (P14 item 4,
 * guides/content-security-policy.md): o nonce vai no cabeçalho da requisição
 * (o Next o lê ali e o aplica aos scripts dele) e a CSP vai na resposta,
 * inclusive nos redirecionamentos. As páginas precisam ser dinâmicas para
 * receber o nonce: o layout raiz chama `connection()`.
 */
export async function proxy(request: NextRequest) {
  const nonce = gerarNonce();
  const csp = montarCsp({
    nonce,
    desenvolvimento: process.env.NODE_ENV === "development",
    ambienteLocal: process.env.NEXT_PUBLIC_APP_ENV === "desenvolvimento",
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    sentryDsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  });
  request.headers.set("x-nonce", nonce);
  request.headers.set("content-security-policy", csp);

  const { sessao, resposta } = await lerSessaoNaBorda(request);
  const decisao = decidirAcesso(request.nextUrl.pathname, sessao);
  if (decisao.tipo === "redirecionar") {
    return comCsp(redirecionarComCookies(request, resposta, decisao.para), csp);
  }
  return comCsp(resposta, csp);
}

function comCsp(resposta: NextResponse, csp: string): NextResponse {
  resposta.headers.set("content-security-policy", csp);
  return resposta;
}

export const config = {
  matcher: [
    // Tudo, menos os arquivos do Next, a marca, o favicon e as rotas de API
    // (webhooks e cron têm autenticação própria, PRD 14). Sem exceção por
    // extensão (.png, .svg): com ela, /familias/qualquer.png abria a rota
    // dinâmica /familias/[id] sem passar pelo proxy. Arquivo novo em
    // public/ que precise abrir sem sessão entra aqui pelo caminho exato.
    // O app instalável da enfermeira (P38) abre sem sessão o manifesto, o
    // service worker e os ícones, que não têm dado nenhum.
    "/((?!_next/|__nextjs|favicon\\.ico$|sw\\.js$|manifest\\.webmanifest$|icones/|brand/|api/).*)",
  ],
};
