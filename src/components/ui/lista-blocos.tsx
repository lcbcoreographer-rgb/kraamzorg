import * as React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { TileIcone } from "./tile-icone";
import { FUNDO_CLARO, type Tom } from "./tons";

/**
 * Lista em blocos (DESIGN.md, 2.3 e 2.5; referência: a lista de tarefas em
 * que cada linha tem o seu tile de cor). Cada item é um bloco macio de raio
 * 16, com o tile do assunto à esquerda, o título e a linha de apoio no
 * meio e, à direita, o que o item tiver (selo, hora, seta). Item com
 * `href` é o bloco inteiro tocável, com 64 px de altura mínima.
 *
 * Sem divisória: o espaço de 8 px entre os blocos separa. Fundo branco por
 * padrão (trabalho a fazer) ou no tom claro do assunto.
 */
export interface ListaBlocosProps extends React.HTMLAttributes<HTMLUListElement> {
  children: React.ReactNode;
}

export function ListaBlocos({ className, ...props }: ListaBlocosProps) {
  return <ul className={cn("flex flex-col gap-2", className)} {...props} />;
}

export interface ItemBlocoProps {
  titulo: React.ReactNode;
  apoio?: React.ReactNode;
  icone?: React.ReactNode;
  /** Tom do tile e, com `fundo="tom"`, do bloco. */
  tom?: Tom;
  fundo?: "branco" | "tom";
  /** O que vai à direita (selo, hora). Com `href` sem `lateral`, uma seta. */
  lateral?: React.ReactNode;
  href?: string;
  className?: string;
}

export function ItemBloco({
  titulo,
  apoio,
  icone,
  tom = "areia",
  fundo = "branco",
  lateral,
  href,
  className,
}: ItemBlocoProps) {
  const conteudo = (
    <>
      {icone ? (
        <TileIcone tom={tom} forma="quadrado" tamanho="m">
          {icone}
        </TileIcone>
      ) : null}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-corpo text-texto leading-snug font-semibold">
          {titulo}
        </span>
        {apoio ? (
          <span className="text-apoio text-texto-2">{apoio}</span>
        ) : null}
      </span>
      {lateral ??
        (href ? (
          <ChevronRight
            aria-hidden="true"
            className="text-texto-2 size-5 shrink-0"
            strokeWidth={1.75}
          />
        ) : null)}
    </>
  );
  const classes = cn(
    "rounded-2 flex min-h-16 items-center gap-3 px-3 py-2.5",
    fundo === "tom" ? FUNDO_CLARO[tom] : "bg-superficie shadow-1",
    href &&
      "text-inherit no-underline transition-[transform,background-color] duration-140 ease-estado active:scale-[0.99]",
    href && fundo === "branco" && "hover:bg-areia-clara",
    className,
  );
  return (
    <li>
      {href ? (
        <Link href={href} className={classes}>
          {conteudo}
        </Link>
      ) : (
        <div className={classes}>{conteudo}</div>
      )}
    </li>
  );
}
