import { NextResponse, type NextRequest } from "next/server";
import { obterAutenticacao } from "@/lib/auth/sessao";

/**
 * Sair. POST vem do botão "Sair" da casca. GET só existe para o proxy
 * encerrar a sessão de um perfil sem papel ou desativado
 * (/sair?motivo=sem-acesso) e mostrar o aviso na tela de entrar.
 */
const AVISOS = new Set(["sem-acesso", "sessao-encerrada"]);

async function sair(aviso: string) {
  await obterAutenticacao().sair();
  // 303: depois de um POST, o navegador segue com GET. O Location é relativo
  // de propósito: com `form-action 'self'` na CSP (P14), o navegador recusa
  // redirecionar o formulário para outro host, e o host que o Next monta em
  // `request.url` pode não ser o que a pessoa digitou (localhost no lugar de
  // 127.0.0.1, ou o nome interno atrás de um proxy).
  return new NextResponse(null, {
    status: 303,
    headers: { Location: `/entrar?aviso=${aviso}` },
  });
}

export async function POST() {
  return sair("saiu");
}

export async function GET(request: NextRequest) {
  const motivo = request.nextUrl.searchParams.get("motivo") ?? "";
  return sair(AVISOS.has(motivo) ? motivo : "sessao-encerrada");
}
