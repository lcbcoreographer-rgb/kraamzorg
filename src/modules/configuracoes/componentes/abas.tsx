import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Abas de conteúdo da tela de Configurações (`abas`, DESIGN.md seção 6):
 * sublinhado dourado de 2 px na ativa, rolam de lado no celular. Links
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
      className="border-linha -mx-4 flex gap-1 overflow-x-auto border-b px-4 lg:-mx-8 lg:px-8"
    >
      {abas.map((aba) => {
        const ehAtiva = aba.chave === ativa;
        return (
          <Link
            key={aba.chave}
            href={`/configuracoes?aba=${aba.chave}`}
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
