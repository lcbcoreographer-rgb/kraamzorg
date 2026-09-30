import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { TileIcone } from "./tile-icone";
import { FUNDO_CLARO, FUNDO_MEDIO, type Tom } from "./tons";

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
  /**
   * "tom" (padrão): bloco no tom claro, tile no tom médio. "medio"
   * [polimento]: bloco no tom médio do assunto, com o tile branco; é o
   * cartão-resumo dentro do bloco de abertura, que precisa de presença
   * contra o dourado-claro. "marinho": o número principal da tela, em
   * bloco marinho com texto creme e tile dourado (um por tela). "branco":
   * cartão branco dentro de um bloco de tom. Sem valor: "marinho" com
   * `destaque`, "medio" sem.
   */
  fundo?: "tom" | "medio" | "marinho" | "branco";
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
  fundo: fundoPedido,
  destaque = false,
  className,
}: CartaoResumoProps) {
  // [polimento] Sem `fundo`, o trio ganha presença: o número principal
  // (`destaque`) em marinho e os outros no tom médio do assunto.
  const fundo = fundoPedido ?? (destaque ? "marinho" : "medio");
  // Sobre marinho, texto creme (13,6:1) e contexto creme-62 (6,7:1); sobre
  // tom médio, só marinho (9,0 a 9,9:1), nunca texto-2 (PRD 20.2 [v4.4]).
  const escuro = fundo === "marinho";
  const conteudo = (
    <>
      <TileIcone
        tom={escuro ? "dourado" : fundo === "medio" ? "branco" : tom}
        tamanho={destaque ? "m" : "p"}
      >
        {icone}
      </TileIcone>
      <span className="flex min-w-0 flex-col gap-1">
        <span
          className={cn(
            "font-titulo text-numero font-medium tabular-nums",
            escuro ? "text-texto-inverso" : "text-texto",
          )}
        >
          {valor}
        </span>
        <span
          className={cn(
            "text-apoio leading-snug font-semibold",
            escuro ? "text-texto-inverso" : "text-texto",
          )}
        >
          {rotulo}
        </span>
        {contexto ? (
          <span
            className={cn(
              "text-mini",
              escuro
                ? "text-texto-inverso-2"
                : fundo === "medio"
                  ? "text-texto"
                  : "text-texto-2",
            )}
          >
            {contexto}
          </span>
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
    fundo === "tom"
      ? FUNDO_CLARO[tom]
      : fundo === "medio"
        ? FUNDO_MEDIO[tom]
        : fundo === "marinho"
          ? "bg-marinho"
          : "bg-superficie",
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
