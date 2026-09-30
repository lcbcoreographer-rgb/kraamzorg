import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Abas de conteúdo da tela de Configurações (DESIGN.md, 2.9 [v4.4]): trilha
 * areia em pílula, a ativa em pílula branca, rolam de lado no celular. Links
 * simples (`?aba=`), sem JavaScript: a tela funciona mesmo antes do
 * cliente carregar, e a aba fica compartilhável por link.
 */
export interface AbaConfiguracoes {
  chave: string;
  rotulo: string;
}

export function AbasConfiguracoes({
  abas,
  ativa,
}: {
  abas: AbaConfiguracoes[];
  ativa: string;
}) {
  return (
    <nav
      aria-label="Seções de configurações"
      className="rounded-pilula bg-areia flex w-fit max-w-full [scrollbar-width:none] gap-1 overflow-x-auto p-1"
    >
      {abas.map((aba) => {
        const ehAtiva = aba.chave === ativa;
        return (
          <Link
            key={aba.chave}
            href={`/configuracoes?aba=${aba.chave}`}
            aria-current={ehAtiva ? "page" : undefined}
            className={cn(
              "text-apoio min-h-toque rounded-pilula ease-estado flex shrink-0 items-center px-4 font-semibold whitespace-nowrap no-underline transition-[background-color,box-shadow,color] duration-140",
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
