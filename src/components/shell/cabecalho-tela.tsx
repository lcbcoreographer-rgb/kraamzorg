import type { ReactNode } from "react";

/**
 * Cabeçalho de tela (protótipo, `.cab-tela`): título único da tela em
 * Jost (t-display, 32 px no celular e 40 px no computador), preso no topo
 * com o fundo creme e uma divisória fina. À direita, o que a tela precisar
 * (indicador de sincronização, ação principal no computador).
 *
 * O título nunca leva nome de família (DESIGN.md, microcopy 11): o nome
 * vai no cabeçalho da família, dentro da página.
 */
export function CabecalhoTela({
  titulo,
  subtitulo,
  lateral,
}: {
  titulo: ReactNode;
  subtitulo?: ReactNode;
  lateral?: ReactNode;
}) {
  return (
    <>
      <header className="bg-fundo border-linha sticky top-0 z-[var(--z-barra)] -mx-4 flex min-h-16 items-center gap-3 border-b px-4 py-2 lg:-mx-8 lg:px-8 lg:py-3">
        <h1 className="font-titulo text-display lg:text-display-lg text-texto font-normal">
          {titulo}
        </h1>
        {lateral ? (
          <div className="ml-auto flex items-center gap-2">{lateral}</div>
        ) : null}
      </header>
      {subtitulo ? (
        <p className="text-apoio text-texto-2 mt-3">{subtitulo}</p>
      ) : null}
    </>
  );
}
