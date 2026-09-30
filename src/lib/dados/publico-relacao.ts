import "server-only";
import { modoDados } from "./modo";
import type {
  PortalFamiliaRepositorio,
  RelacaoPublicaRepositorio,
} from "./tipos-relacao";

/**
 * Fábricas das páginas abertas do relacionamento (P47, P49 e P51): sem
 * usuário de equipe, por isso fora de obterRepositorios(). Supabase por
 * padrão (cliente de serviço só nas seis funções public.*, ou a sessão da
 * própria família no portal); demonstração só em desenvolvimento, pela mesma
 * trava de modo.ts. Import dinâmico: as fixtures fictícias não entram no
 * pacote de produção das rotas públicas.
 */
export async function obterRelacaoPublica(): Promise<RelacaoPublicaRepositorio> {
  if (modoDados() === "demonstracao") {
    const { criarRelacaoPublicaDemonstracao } =
      await import("./demonstracao/relacao-publica");
    return criarRelacaoPublicaDemonstracao();
  }
  const { criarRelacaoPublicaSupabase } =
    await import("./supabase/relacao-publica");
  return criarRelacaoPublicaSupabase();
}

/**
 * Portal da família. Na real, com a sessão do Supabase Auth da própria
 * família (a RLS e a função api.portal_familia decidem o que ela vê). Na
 * demonstração, a pessoa vem do cookie de demonstração da família.
 */
export async function obterPortalFamilia(
  pessoaIdDemonstracao: string | null,
): Promise<PortalFamiliaRepositorio> {
  if (modoDados() === "demonstracao") {
    const { criarPortalFamiliaDemonstracao } =
      await import("./demonstracao/relacao-publica");
    return criarPortalFamiliaDemonstracao(pessoaIdDemonstracao);
  }
  const { criarClienteServidor } = await import("@/lib/db/cliente-servidor");
  const { criarPortalFamiliaSupabase } = await import("./supabase/relacao");
  return criarPortalFamiliaSupabase({
    cliente: await criarClienteServidor(),
    usuarioId: null,
  });
}
