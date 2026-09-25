import { NextResponse, type NextRequest } from "next/server";
import { obterAutenticacao } from "@/lib/auth/sessao";

/**
 * Sair. POST vem do botão "Sair" da casca. GET só existe para o proxy
 * encerrar a sessão de um perfil sem papel ou desativado
 * (/sair?motivo=sem-acesso) e mostrar o aviso na tela de entrar.
 */
const AVISOS = new Set(["sem-acesso", "sessao-encerrada"]);

async function sair(request: NextRequest, aviso: string) {
  await obterAutenticacao().sair();
  // 303: depois de um POST, o navegador segue com GET.
  return NextResponse.redirect(new URL(`/entrar?aviso=${aviso}`, request.url), 303);
}

export async function POST(request: NextRequest) {
  return sair(request, "saiu");
}

export async function GET(request: NextRequest) {
  const motivo = request.nextUrl.searchParams.get("motivo") ?? "";
  return sair(request, AVISOS.has(motivo) ? motivo : "sessao-encerrada");
}
