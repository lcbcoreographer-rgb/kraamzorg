import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Barra lateral (DESIGN.md, seção 6). Computador, marinho, 248 px, símbolo
 * e nome do sistema no topo. Grupos com título em frase, itens de 44 px,
 * ativo em marinho-claro com ícone dourado. Mostra só o que o papel pode
 * abrir.
 *
 * Este componente é estático (sem papel): os grupos e itens vêm sempre por
 * propriedade. Os grupos por papel (Comercial, Operação, Experiência,
 * Gestão, Sistema) são da casca do app, depois do P07.
 */
export interface ItemBarraLateral {
  rotulo: string;
  href: string;
  icone: React.ReactNode;
  ativo?: boolean;
  contador?: number;
  /** Contador em vermelho (alerta), em vez do contador neutro padrão. */
  contadorAlerta?: boolean;
}

export interface GrupoBarraLateral {
  titulo: string;
  itens: ItemBarraLateral[];
}

export interface BarraLateralProps {
  /** Nome do sistema, ao lado do símbolo (ex: "Kraamzorg OS"). */
  nomeMarca: string;
  /** Caminho do símbolo em `/public/brand` (provisório até o SVG oficial). */
  simboloSrc: string;
  grupos: GrupoBarraLateral[];
  /** Rodapé opcional (nome e papel da pessoa logada). */
  rodape?: React.ReactNode;
  className?: string;
}

export function BarraLateral({
  nomeMarca,
  simboloSrc,
  grupos,
  rodape,
  className,
}: BarraLateralProps) {
  return (
    <nav
      aria-label={nomeMarca}
      className={cn(
        "w-lateral bg-marinho text-texto-inverso sticky top-0 hidden h-dvh flex-col gap-6 overflow-y-auto px-4 py-6 lg:flex",
        className,
      )}
    >
      <div className="flex items-center gap-3 px-2">
        <Image src={simboloSrc} alt="" width={36} height={31} />
        <span className="font-titulo text-lg font-medium tracking-wide">
          {nomeMarca}
        </span>
      </div>

      {grupos.map((grupo) => (
        <div key={grupo.titulo} className="flex flex-col gap-0.5">
          <span className="text-mini text-texto-inverso-2 px-3 pb-1">
            {grupo.titulo}
          </span>
          {grupo.itens.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={item.ativo ? "page" : undefined}
              className={cn(
                "min-h-toque rounded-pilula text-apoio text-texto-inverso ease-estado flex items-center gap-3 px-3 font-medium no-underline transition-colors duration-140",
                "[&>svg]:text-texto-inverso-2 [&>svg]:size-5",
                item.ativo
                  ? "bg-marinho-claro [&>svg]:text-destaque font-semibold"
                  : "hover:bg-[color-mix(in_srgb,var(--marinho-claro)_60%,var(--marinho))]",
              )}
            >
              {item.icone}
              <span>{item.rotulo}</span>
              {item.contador ? (
                <span
                  className={cn(
                    "text-mini ml-auto font-mono",
                    item.contadorAlerta
                      ? "rounded-pilula bg-areia text-marinho px-2"
                      : "text-texto-inverso-2",
                  )}
                >
                  {item.contador}
                </span>
              ) : null}
            </Link>
          ))}
        </div>
      ))}

      {rodape ? (
        <div className="border-marinho-claro text-apoio mt-auto border-t pt-3">
          {rodape}
        </div>
      ) : null}
    </nav>
  );
}
