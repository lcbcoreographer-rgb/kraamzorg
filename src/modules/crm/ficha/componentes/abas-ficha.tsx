import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Abas de conteúdo da ficha (DESIGN.md, 2.9 e seção 6, "Abas de
 * conteúdo"): na direção "Colo", trilha areia em pílula com a aba ativa numa
 * pílula branca de sombra leve, o mesmo desenho de `AbasPilula`. Continuam
 * links numa `nav` com `aria-current`, porque cada aba é um endereço
 * (`?aba=`); rolam de lado no celular. Links `?aba=`, sem depender de JavaScript (mesmo padrão
 * de `src/modules/configuracoes/componentes/abas.tsx`, lido como
 * referência). A aba que o papel não pode ver não aparece: quem chama já
 * filtra a lista.
 */
export interface AbaFicha {
  chave: string;
  rotulo: string;
}

export function AbasFicha({
  familiaId,
  abas,
  ativa,
}: {
  familiaId: string;
  abas: AbaFicha[];
  ativa: string;
}) {
  return (
    <nav
      aria-label="Seções da ficha"
      className="rounded-pilula bg-areia tablet:inline-flex tablet:w-auto flex w-full max-w-full [scrollbar-width:none] gap-1 overflow-x-auto p-1"
    >
      {abas.map((aba) => {
        const ehAtiva = aba.chave === ativa;
        return (
          <Link
            key={aba.chave}
            href={`/familias/${familiaId}?aba=${aba.chave}`}
            aria-current={ehAtiva ? "page" : undefined}
            className={cn(
              "text-apoio min-h-toque rounded-pilula ease-estado tablet:flex-none flex flex-1 shrink-0 items-center justify-center px-4 font-semibold whitespace-nowrap no-underline transition-[background-color,box-shadow,color] duration-140",
              ehAtiva
                ? "bg-superficie text-texto shadow-1"
                : "text-texto-2 hover:bg-areia-clara hover:text-texto",
            )}
          >
            {aba.rotulo}
          </Link>
        );
      })}
    </nav>
  );
}
