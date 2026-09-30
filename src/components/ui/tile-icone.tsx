import * as React from "react";
import { cn } from "@/lib/utils";
import { FUNDO_CLARO, FUNDO_MEDIO, type Tom } from "./tons";

/**
 * Ícone em tile (DESIGN.md, 2.7): o ícone Lucide em marinho dentro de um
 * círculo ou de um quadradinho de raio 16, no tom do assunto. O tile diz
 * o assunto (visita, tarefa, conversa, agenda), nunca o estado: sirene e
 * octógono continuam sem tile, dentro da faixa do estado.
 *
 * Decorativo: quem usa põe o texto ao lado. O ícone passado recebe o
 * tamanho certo (18, 20 ou 24 px) pelo seletor `[&_svg]`.
 */
export interface TileIconeProps {
  children: React.ReactNode;
  tom?: Tom | "marinho" | "branco";
  /** Médio (padrão) sobre fundo creme ou branco; claro dentro de bloco médio. */
  intensidade?: "media" | "clara";
  forma?: "circulo" | "quadrado";
  /** p = 36 px, m = 44 px (padrão), g = 56 px. */
  tamanho?: "p" | "m" | "g";
  className?: string;
}

const TAMANHO: Record<NonNullable<TileIconeProps["tamanho"]>, string> = {
  p: "size-9 [&_svg]:size-[18px]",
  m: "size-11 [&_svg]:size-5",
  g: "size-14 [&_svg]:size-6",
};

export function TileIcone({
  children,
  tom = "dourado",
  intensidade = "media",
  forma = "circulo",
  tamanho = "m",
  className,
}: TileIconeProps) {
  const fundo =
    tom === "marinho"
      ? "bg-marinho text-texto-inverso"
      : tom === "branco"
        ? "bg-superficie text-texto"
        : cn(
            intensidade === "media" ? FUNDO_MEDIO[tom] : FUNDO_CLARO[tom],
            "text-texto",
          );
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center [&_svg]:stroke-[1.75]",
        forma === "circulo" ? "rounded-pilula" : "rounded-2",
        TAMANHO[tamanho],
        fundo,
        className,
      )}
    >
      {children}
    </span>
  );
}
