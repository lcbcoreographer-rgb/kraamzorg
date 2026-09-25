import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { modoDados } from "@/lib/dados/modo";
import { configuracaoSupabase } from "@/lib/db/configuracao";
import type { Database } from "@/lib/db/types";
import { sessaoBordaDemonstracao } from "./demonstracao-sessao";
import { COOKIE_DEMONSTRACAO } from "./demonstracao-cookie";
import { sessaoBordaSupabase } from "./supabase-sessao";
import type { SessaoBorda } from "./tipos";

/**
 * Leitura da sessão no proxy (src/proxy.ts), antes de a tela renderizar.
 * Na real, é aqui que o @supabase/ssr renova o token e grava os cookies
 * novos na resposta (o Server Component não pode gravar cookie).
 */
export async function lerSessaoNaBorda(
  request: NextRequest,
): Promise<{ sessao: SessaoBorda | null; resposta: NextResponse }> {
  if (modoDados() === "demonstracao") {
    return {
      sessao: sessaoBordaDemonstracao(request.cookies.get(COOKIE_DEMONSTRACAO)?.value),
      resposta: NextResponse.next({ request }),
    };
  }

  let resposta = NextResponse.next({ request });
  const { url, chaveAnonima } = configuracaoSupabase();
  const cliente = createServerClient<Database>(url, chaveAnonima, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesParaGravar, cabecalhos) {
        for (const { name, value } of cookiesParaGravar) request.cookies.set(name, value);
        resposta = NextResponse.next({ request });
        for (const { name, value, options } of cookiesParaGravar) {
          resposta.cookies.set(name, value, options);
        }
        for (const [nome, valor] of Object.entries(cabecalhos ?? {})) {
          resposta.headers.set(nome, valor);
        }
      },
    },
  });

  const sessao = await sessaoBordaSupabase(cliente);
  return { sessao, resposta };
}

/** Redireciona sem perder os cookies que a renovação do token gravou. */
export function redirecionarComCookies(
  request: NextRequest,
  resposta: NextResponse,
  destino: string,
): NextResponse {
  const redirecionamento = NextResponse.redirect(new URL(destino, request.url));
  for (const cookie of resposta.cookies.getAll()) redirecionamento.cookies.set(cookie);
  return redirecionamento;
}
