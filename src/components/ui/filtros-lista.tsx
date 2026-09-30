import Link from "next/link";

/**
 * Filtros de uma lista em pílulas (o mesmo desenho dos filtros de cobranças):
 * cada um é um link para a mesma tela com outra busca, o ativo em marinho.
 * Sem estado no cliente: a URL guarda o filtro.
 */
export interface ItemFiltro {
  rotulo: string;
  href: string;
  ativo: boolean;
}

export function FiltrosLista({
  rotulo,
  itens,
}: {
  rotulo: string;
  itens: ItemFiltro[];
}) {
  return (
    <nav aria-label={rotulo} className="flex flex-wrap gap-2">
      {itens.map((item) => (
        <Link
          key={item.rotulo}
          href={item.href}
          aria-current={item.ativo ? "page" : undefined}
          className={
            item.ativo
              ? "rounded-pilula bg-marinho text-texto-inverso min-h-toque text-apoio inline-flex items-center px-4 font-semibold no-underline"
              : "rounded-pilula border-borda-campo bg-superficie text-texto hover:bg-marinho-08 min-h-toque text-apoio inline-flex items-center border-[1.5px] px-4 font-semibold no-underline"
          }
        >
          {item.rotulo}
        </Link>
      ))}
    </nav>
  );
}
