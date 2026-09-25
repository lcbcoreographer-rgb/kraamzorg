import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { configuracaoSupabase } from "./configuracao";
import type { Database } from "./types";

/**
 * Cliente Supabase de servidor (Server Components, Server Actions e rotas):
 * lê e renova a sessão pelos cookies e fala com o banco como o usuário
 * logado, então toda leitura passa pela RLS (PRD 13). Escrita relevante e
 * dado sensível vão por RPC às funções do schema api
 * (`cliente.schema("api").rpc(...)`), nunca por update direto de estágio.
 *
 * Em Server Component o Next não deixa gravar cookie; a renovação do token
 * fica com o proxy (src/proxy.ts), por isso o setAll ignora a recusa.
 */
export async function criarClienteServidor() {
  const { url, chaveAnonima } = configuracaoSupabase();
  const loja = await cookies();

  return createServerClient<Database>(url, chaveAnonima, {
    cookies: {
      getAll() {
        return loja.getAll();
      },
      setAll(cookiesParaGravar) {
        try {
          for (const { name, value, options } of cookiesParaGravar) {
            loja.set(name, value, options);
          }
        } catch {
          // Server Component: o proxy renova a sessão na próxima requisição.
        }
      },
    },
  });
}

export type ClienteServidor = Awaited<ReturnType<typeof criarClienteServidor>>;
