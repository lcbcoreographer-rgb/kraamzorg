import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Cabeçalho de tela (protótipo, `.cab-tela`): título único da tela em
 * Jost (t-display, 32 px no celular e 40 px no computador), preso no topo
 * com o fundo creme e uma divisória fina. À direita, o que a tela precisar
 * (indicador de sincronização, ação principal no computador).
 *
 * `abertura` (DESIGN.md, 11.4): nas telas que abrem o dia (Hoje da
 * enfermeira, Início de cada papel), o título é o dia ("Terça, 29/09") e a
 * frase de estado vem logo abaixo, em `text-3` marinho, e não em cinza
 * pequeno. As outras telas mantêm o nome como título e a frase de apoio
 * em `texto-2`.
 *
 * O título nunca leva nome de família (DESIGN.md, microcopy 11): o nome
 * vai no cabeçalho da família, dentro da página.
 */
export function CabecalhoTela({
  titulo,
  subtitulo,
  lateral,
  abertura,
}: {
  titulo: ReactNode;
  subtitulo?: ReactNode;
  lateral?: ReactNode;
  abertura?: boolean;
}) {
  return (
    <>
      <header className="bg-fundo border-linha sticky top-0 z-[var(--z-barra)] -mx-4 flex min-h-16 flex-wrap items-center gap-x-3 gap-y-2 border-b px-4 py-2 lg:-mx-8 lg:px-8 lg:py-3">
        <h1 className="font-titulo text-display lg:text-display-lg text-texto font-normal">
          {titulo}
        </h1>
        {lateral ? (
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {lateral}
          </div>
        ) : null}
      </header>
      {subtitulo ? (
        <p
          className={cn(
            "mt-3 max-w-[60ch]",
            abertura ? "text-3 text-texto" : "text-apoio text-texto-2",
          )}
        >
          {subtitulo}
        </p>
      ) : null}
    </>
  );
}
