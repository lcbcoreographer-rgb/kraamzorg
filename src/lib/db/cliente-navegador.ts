import { createBrowserClient } from "@supabase/ssr";
import { configuracaoSupabase } from "./configuracao";
import type { Database } from "./types";

/**
 * Cliente Supabase do navegador (componentes "use client"). Só com a chave
 * anônima: tudo que ele lê passa pela RLS do usuário logado. Nunca recebe a
 * service_role (CLAUDE.md, Segurança e LGPD).
 *
 * Preferência do app: ler no servidor (cliente-servidor.ts) e gravar por
 * Server Action. Este cliente existe para o que só o navegador faz, como
 * assinar mudança em tempo real ou o motor offline do P12.
 */
export function criarClienteNavegador() {
  const { url, chaveAnonima } = configuracaoSupabase();
  return createBrowserClient<Database>(url, chaveAnonima);
}
