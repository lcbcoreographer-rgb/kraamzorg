import "server-only";
import { cache } from "react";
import { obterSessao } from "@/lib/auth/sessao";
import type { SessaoUsuario } from "@/lib/auth/tipos";
import { criarClienteServidor } from "@/lib/db/cliente-servidor";
import { modoDados, type ModoDados } from "@/lib/dados/modo";
import { criarConfiguracoesModuloDemonstracao } from "./demonstracao";
import type { ConfiguracoesModuloRepositorio } from "./repositorio";
import { criarConfiguracoesModuloSupabase } from "./supabase";

export type { ConfiguracoesModuloRepositorio } from "./repositorio";
export * from "./tipos";

/**
 * Fábrica do repositório do módulo (mesmo padrão de
 * `@/lib/dados/fabrica.ts`): Supabase com a sessão do usuário em qualquer
 * ambiente, demonstração só em desenvolvimento (erro fora dele, nunca
 * silêncio, `src/lib/dados/modo.ts`).
 */
export async function criarRepositorioModulo(
  modo: ModoDados,
  sessao: SessaoUsuario | null,
): Promise<ConfiguracoesModuloRepositorio> {
  if (modo === "demonstracao") {
    return criarConfiguracoesModuloDemonstracao({
      usuarioId: sessao?.usuarioId ?? null,
      papeis: sessao?.papeis ?? [],
    });
  }
  return criarConfiguracoesModuloSupabase({
    cliente: await criarClienteServidor(),
    usuarioId: sessao?.usuarioId ?? null,
  });
}

/** Um repositório por renderização (Server Component ou Server Action). */
export const obterRepositorioModulo = cache(
  async (): Promise<ConfiguracoesModuloRepositorio> => {
    return criarRepositorioModulo(modoDados(), await obterSessao());
  },
);
