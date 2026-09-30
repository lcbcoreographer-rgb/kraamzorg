import "server-only";
import { modoDados } from "./modo";
import type { PesquisaPublicaRepositorio } from "./tipos-ocorrencia";

/**
 * Fábrica da pesquisa pública da família (P42): sem sessão de usuário, por
 * isso fora de obterRepositorios(). Supabase por padrão; demonstração só em
 * desenvolvimento, pela mesma trava de modo.ts. Import dinâmico: as fixtures
 * fictícias não entram no pacote de produção da rota pública.
 */
export async function obterRepositorioPesquisa(): Promise<PesquisaPublicaRepositorio> {
  if (modoDados() === "demonstracao") {
    const { criarPesquisaPublicaDemonstracao } =
      await import("./demonstracao/ocorrencia");
    return criarPesquisaPublicaDemonstracao();
  }
  const { criarPesquisaPublicaSupabase } = await import("./supabase/pesquisa");
  return criarPesquisaPublicaSupabase();
}
