import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { TileIcone } from "./tile-icone";
import { FUNDO_CLARO, type Tom } from "./tons";

/**
 * Bloco com aba [polimento] (DESIGN.md, 2.4; referências: as abas que
 * encaixam no bloco e os blocos de cor com presença). O título mora numa
 * aba no mesmo tom do bloco, com a curva côncava fechando a junção
 * (`encaixe-aba`); o conteúdo vem em cartões brancos dentro do bloco.
 *
 * `tom="neutro"`: bloco e aba brancos, sem tom de apoio. É o que vale para
 * assunto sensível (alerta clínico, freio, perda, intercorrência): a forma
 * continua, a cor não (PRD 20.2 [v4.4], regra 3).
 */
export interface BlocoAbaProps {
  tom: Tom | "neutro";
  icone: React.ReactNode;
  titulo: React.ReactNode;
  /** Id do `h2`, para `aria-labelledby` e para o link do cartão-resumo. */
  idTitulo: string;
  /** Número ao lado do título (sempre com o título por perto). */
  contagem?: number;
  /** Link no pé do bloco ("Ver a agenda"). */
  acao?: { rotulo: string; href: string };
  children: React.ReactNode;
  className?: string;
}

const COR_ABA: Record<Tom | "neutro", string> = {
  dourado: "var(--dourado-claro)",
  areia: "var(--areia-clara)",
  salvia: "var(--salvia-clara)",
  lavanda: "var(--lavanda-clara)",
  argila: "var(--argila-clara)",
  neutro: "var(--superficie)",
};

export function BlocoAba({
  tom,
  icone,
  titulo,
  idTitulo,
  contagem,
  acao,
  children,
  className,
}: BlocoAbaProps) {
  const fundo = tom === "neutro" ? "bg-superficie" : FUNDO_CLARO[tom];
  return (
    <section
      aria-labelledby={idTitulo}
      className={cn("flex scroll-mt-4 flex-col", className)}
      style={{ "--cor-aba": COR_ABA[tom] } as React.CSSProperties}
    >
      <div
        className={cn(
          "rounded-t-3 relative z-[1] flex items-center gap-3 self-start py-2.5 pr-5 pl-3",
          fundo,
          // No neutro, a aba ganha a mesma borda do bloco e cobre a linha de
          // cima dele (-mb-px); a curva côncava fica só nos blocos de tom.
          tom === "neutro"
            ? "border-linha -mb-px border border-b-0"
            : "encaixe-aba",
        )}
      >
        <TileIcone
          tom={tom === "neutro" ? "branco" : tom}
          forma="quadrado"
          tamanho="p"
          className={tom === "neutro" ? "border-linha border" : undefined}
        >
          {icone}
        </TileIcone>
        <h2
          id={idTitulo}
          className="font-titulo text-2 text-texto flex items-center gap-2"
        >
          {titulo}
          {contagem !== undefined ? (
            <span className="rounded-pilula bg-superficie text-apoio text-texto inline-flex min-h-7 min-w-7 items-center justify-center px-2 font-mono tabular-nums">
              <span className="sr-only">, </span>
              {contagem}
            </span>
          ) : null}
        </h2>
      </div>
      <div
        className={cn(
          "rounded-3 flex flex-1 flex-col gap-2 rounded-tl-none p-3 lg:p-4",
          fundo,
          tom === "neutro" && "border-linha border",
        )}
      >
        {children}
        {acao ? (
          <Link
            href={acao.href}
            className="text-apoio text-texto rounded-pilula hover:bg-superficie/60 min-h-toque inline-flex items-center gap-2 self-start px-3 font-semibold underline-offset-4 hover:underline"
          >
            {acao.rotulo}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        ) : null}
      </div>
    </section>
  );
}
