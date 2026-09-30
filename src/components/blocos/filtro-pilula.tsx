import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Filtros de uma lista na trilha em pílula da direção "Colo" (DESIGN.md,
 * 2.9): trilha areia, o filtro ativo numa pílula branca de sombra leve, a
 * contagem em mono ao lado do rótulo. O mesmo desenho de `AbasPilula`, mas
 * cada filtro continua um link de navegação (`nav` com `aria-current`),
 * porque troca a busca da URL e não um painel da mesma tela.
 */
export interface ItemFiltroPilula {
  rotulo: string;
  href: string;
  ativo: boolean;
  /** Quantos itens o filtro mostra, quando a tela já sabe. */
  contagem?: number;
}

export function FiltroPilula({
  rotulo,
  itens,
  className,
}: {
  /** Nome acessível da navegação ("Filtrar notas"). */
  rotulo: string;
  itens: ItemFiltroPilula[];
  className?: string;
}) {
  return (
    <nav
      aria-label={rotulo}
      className={cn(
        "rounded-pilula bg-areia flex w-fit max-w-full [scrollbar-width:none] gap-1 overflow-x-auto p-1",
        className,
      )}
    >
      {itens.map((item) => (
        <Link
          key={item.rotulo}
          href={item.href}
          aria-current={item.ativo ? "page" : undefined}
          className={cn(
            "min-h-toque rounded-pilula text-apoio ease-estado inline-flex shrink-0 items-center gap-2 px-4 font-semibold whitespace-nowrap no-underline transition-[background-color,box-shadow,color] duration-140",
            item.ativo
              ? "bg-superficie text-texto shadow-1"
              : "text-texto-2 hover:bg-areia-clara hover:text-texto",
          )}
        >
          {item.rotulo}
          {item.contagem !== undefined ? (
            <span className="text-mini font-mono font-medium tabular-nums">
              {item.contagem}
            </span>
          ) : null}
        </Link>
      ))}
    </nav>
  );
}
