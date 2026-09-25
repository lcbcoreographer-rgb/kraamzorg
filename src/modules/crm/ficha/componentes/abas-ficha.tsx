import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Abas de conteúdo da ficha (`abas`, DESIGN.md seção 6, protótipo
 * `comercial-ficha.html`): sublinhado dourado de 2 px na ativa, rolam de
 * lado no celular. Links `?aba=`, sem depender de JavaScript (mesmo padrão
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
      className="border-linha flex gap-1 overflow-x-auto border-b"
    >
      {abas.map((aba) => {
        const ehAtiva = aba.chave === ativa;
        return (
          <Link
            key={aba.chave}
            href={`/familias/${familiaId}?aba=${aba.chave}`}
            aria-current={ehAtiva ? "page" : undefined}
            className={cn(
              "text-apoio min-h-toque flex shrink-0 items-center border-b-2 px-3 font-semibold whitespace-nowrap transition-colors duration-140",
              ehAtiva
                ? "border-dourado text-texto"
                : "text-texto-2 hover:text-texto border-transparent",
            )}
          >
            {aba.rotulo}
          </Link>
        );
      })}
    </nav>
  );
}
