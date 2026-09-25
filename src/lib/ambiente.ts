/**
 * Identifica o ambiente atual a partir de `NEXT_PUBLIC_APP_ENV`
 * (.env.example, P10). Sem valor, assume "desenvolvimento". Usada para
 * decidir o que existe só fora de produção (ex: /design-system).
 */
export function estaEmProducao(): boolean {
  return process.env.NEXT_PUBLIC_APP_ENV === "producao";
}
