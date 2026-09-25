import { obterLoja } from "@/lib/dados/demonstracao/loja";
import { lerCookieDemonstracao } from "./demonstracao-cookie";
import type { SessaoBorda, SessaoUsuario } from "./tipos";

/**
 * Sessão fictícia do modo demonstração a partir do cookie. Sem
 * "server-only" nem next/headers: o proxy também usa. A revogação da
 * diretoria vale para sessão aberta antes dela.
 */
export function sessaoDemonstracaoDoCookie(
  valor: string | undefined,
): SessaoUsuario | null {
  const dados = lerCookieDemonstracao(valor);
  if (!dados) return null;
  const loja = obterLoja();
  const usuario = loja.usuarios.find((u) => u.id === dados.u);
  if (!usuario) return null;
  const revogadaEm = loja.sessoesRevogadasEm[usuario.id];
  if (revogadaEm !== undefined && revogadaEm >= dados.em) return null;
  return {
    usuarioId: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    papeis: [...usuario.papeis],
    ativo: usuario.ativo,
    aal: dados.aal,
    aalPossivel: usuario.mfaCadastrado ? "aal2" : "aal1",
  };
}

export function sessaoBordaDemonstracao(
  valor: string | undefined,
): SessaoBorda | null {
  const sessao = sessaoDemonstracaoDoCookie(valor);
  if (!sessao) return null;
  const { usuarioId, papeis, ativo, aal, aalPossivel } = sessao;
  return { usuarioId, papeis, ativo, aal, aalPossivel };
}
