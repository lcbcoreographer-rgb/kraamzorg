import "server-only";
import { cache } from "react";
import { obterSessao } from "@/lib/auth/sessao";
import type { SessaoUsuario } from "@/lib/auth/tipos";
import { criarClienteServidor } from "@/lib/db/cliente-servidor";
import { criarRepositoriosDemonstracao } from "./demonstracao";
import { modoDados, type ModoDados } from "./modo";
import type { Repositorios } from "./repositorios";
import { criarRepositoriosSupabase } from "./supabase";

/**
 * Fábrica de servidor dos repositórios. Toda tela chama
 * `await obterRepositorios()` e recebe as mesmas interfaces, com a
 * implementação que o ambiente pede (modo.ts): Supabase com a sessão do
 * usuário (RLS) em qualquer ambiente; demonstração só em desenvolvimento,
 * e com erro, nunca em silêncio, se alguém pedir demonstração fora dele.
 */
export async function criarRepositorios(
  modo: ModoDados,
  sessao: SessaoUsuario | null,
): Promise<Repositorios> {
  if (modo === "demonstracao") {
    return criarRepositoriosDemonstracao({
      usuarioId: sessao?.usuarioId ?? null,
      papeis: sessao?.papeis ?? [],
      aal: sessao?.aal ?? "aal1",
    });
  }
  return criarRepositoriosSupabase({
    cliente: await criarClienteServidor(),
    usuarioId: sessao?.usuarioId ?? null,
  });
}

/** Repositórios da requisição atual (um conjunto por renderização). */
export const obterRepositorios = cache(async (): Promise<Repositorios> => {
  return criarRepositorios(modoDados(), await obterSessao());
});
