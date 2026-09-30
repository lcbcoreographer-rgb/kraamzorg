import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { TileIcone } from "./tile-icone";
import { FUNDO_CLARO, type Tom } from "./tons";

/**
 * Cartão-resumo com número grande (DESIGN.md, 2.3 e 2.6; referência: os
 * três números em tile do app de estudos). Bloco no tom claro do assunto,
 * o ícone num tile do tom médio, o número em Jost de 44 px e, embaixo, o
 * rótulo e o contexto em frase. Nenhum número sozinho: `contexto` diz com
 * o que comparar ("a primeira às 09:00", "1 atrasada").
 *
 * Com `href`, o cartão inteiro é o link, e o nome acessível junta número e
 * rótulo ("4 tarefas para hoje"). Nunca em tela de família em estado
 * sensível (PRD 20.2 [v4.4], regra 3).
 */
export interface CartaoResumoProps {
  tom: Tom;
  icone: React.ReactNode;
  /** O que o número conta, em frase curta ("tarefas para hoje"). */
  rotulo: React.ReactNode;
  valor: React.ReactNode;
  /** Comparação ou próximo passo, em frase ("1 atrasada"). */
  contexto?: React.ReactNode;
  href?: string;
  /** "pilha" (padrão): tile, número e rótulo empilhados. "linha": tile à esquerda, para ocupar a largura. */
  arranjo?: "pilha" | "linha";
  /** "tom" (padrão): bloco no tom claro. "branco": dentro de um bloco de tom (o cabeçalho do dia). */
  fundo?: "tom" | "branco";
  /**
   * O número principal do trio: no celular ocupa a linha inteira, com o
   * tile e o número à esquerda e o rótulo ao lado; a partir de 600 px
   * volta a empilhar como os outros. Quem monta a grade dá `col-span-2`.
   */
  destaque?: boolean;
  className?: string;
}

export function CartaoResumo({
  tom,
  icone,
  rotulo,
  valor,
  contexto,
  href,
  arranjo = "pilha",
  fundo = "tom",
  destaque = false,
  className,
}: CartaoResumoProps) {
  const conteudo = (
    <>
      <TileIcone tom={tom} tamanho="p">
        {icone}
      </TileIcone>
      <span className="flex min-w-0 flex-col gap-1">
        <span className="font-titulo text-numero text-texto font-medium tabular-nums">
          {valor}
        </span>
        <span className="text-apoio text-texto leading-snug font-semibold">
          {rotulo}
        </span>
        {contexto ? (
          <span className="text-mini text-texto-2">{contexto}</span>
        ) : null}
      </span>
    </>
  );
  const classes = cn(
    "rounded-3 flex p-4 text-left",
    destaque
      ? "tablet:flex-col tablet:items-start tablet:gap-3 flex-row items-center gap-4"
      : arranjo === "pilha"
        ? "flex-col gap-3"
        : "items-start gap-4",
    fundo === "tom" ? FUNDO_CLARO[tom] : "bg-superficie",
    href &&
      "text-inherit no-underline transition-[transform,box-shadow] duration-140 ease-estado hover:shadow-1 active:scale-[0.985]",
    className,
  );
  if (href) {
    return (
      <Link href={href} className={classes}>
        {conteudo}
      </Link>
    );
  }
  return <div className={classes}>{conteudo}</div>;
}
