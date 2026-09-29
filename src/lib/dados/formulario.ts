import "server-only";
import { modoDados } from "./modo";
import type { FormularioContratoRepositorio } from "./repositorios";

/**
 * Fábrica do formulário seguro público (P30): sem sessão de usuário, por
 * isso fora de obterRepositorios(). Supabase por padrão; demonstração só
 * em desenvolvimento, pela mesma trava de modo.ts. Import dinâmico: as
 * fixtures fictícias não entram no pacote de produção da rota pública.
 */
export async function obterRepositorioFormulario(): Promise<FormularioContratoRepositorio> {
  if (modoDados() === "demonstracao") {
    const { criarFormularioDemonstracao } =
      await import("./demonstracao/venda");
    return criarFormularioDemonstracao();
  }
  const { criarFormularioSupabase } = await import("./supabase/formulario");
  return criarFormularioSupabase();
}
