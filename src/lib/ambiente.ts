/**
 * Identifica o ambiente atual a partir de `NEXT_PUBLIC_APP_ENV`
 * (.env.example, P10). Usada para decidir o que existe só fora de produção
 * (ex: /design-system).
 *
 * `vitrineLiberada()` libera por lista explícita ("desenvolvimento" ou
 * "homologacao"), em vez de checar `!estaEmProducao()`: sem a variável, ou
 * com um valor digitado errado (ex: "production", em inglês), o app deve
 * recusar, não liberar por omissão (achado da auditoria da P10 parcial:
 * sem NEXT_PUBLIC_APP_ENV a rota respondia 200 em produção). `VERCEL_ENV`
 * entra como segunda trava, só do lado do servidor: mesmo que alguém
 * esqueça de configurar NEXT_PUBLIC_APP_ENV no Vercel, um deploy de
 * produção (`VERCEL_ENV === "production"`) nunca libera a vitrine.
 */
export function estaEmProducao(): boolean {
  return process.env.NEXT_PUBLIC_APP_ENV === "producao";
}

export function vitrineLiberada(): boolean {
  const appEnvLiberado =
    process.env.NEXT_PUBLIC_APP_ENV === "desenvolvimento" ||
    process.env.NEXT_PUBLIC_APP_ENV === "homologacao";

  if (!appEnvLiberado) {
    return false;
  }

  if (process.env.VERCEL_ENV === "production") {
    return false;
  }

  return true;
}
