import * as React from "react";
import { cn } from "@/lib/utils";
import { TileIcone } from "@/components/ui/tile-icone";
import type { Tom } from "@/components/ui/tons";

/**
 * Seção em bloco da direção "Colo" (DESIGN.md, 6.1, itens 1 e 4): cada
 * assunto da tela tem um título com o ícone num tile quadrado do tom do
 * assunto, o `h2` em Jost 20 e, quando conta alguma coisa, a contagem numa
 * pílula areia com o número em mono. À direita do título, o que a seção
 * precisar (um link, uma ação curta).
 *
 * Só o cabeçalho da seção; o conteúdo vem como filho, do jeito que o
 * assunto pede (lista em blocos, cartão de tom, tabela). Em tela de família
 * em estado sensível, quem usa passa `semTom`: o tile fica branco com
 * contorno, sem tom de apoio (PRD 20.2 [v4.4], regra 3).
 */
export interface SecaoBlocoProps extends Omit<
  React.HTMLAttributes<HTMLElement>,
  "title"
> {
  /** id do título, para o `aria-labelledby` da seção. */
  idTitulo: string;
  titulo: React.ReactNode;
  icone?: React.ReactNode;
  tom?: Tom;
  /** Contagem ao lado do título (pílula areia, número em mono). */
  contagem?: number;
  /** O que fica à direita do título (link, ação curta). */
  lateral?: React.ReactNode;
  /** Frase de apoio logo abaixo do título. */
  apoio?: React.ReactNode;
  nivel?: "h2" | "h3";
  semTom?: boolean;
  children?: React.ReactNode;
}

export function SecaoBloco({
  idTitulo,
  titulo,
  icone,
  tom = "areia",
  contagem,
  lateral,
  apoio,
  nivel: Titulo = "h2",
  semTom = false,
  className,
  children,
  ...props
}: SecaoBlocoProps) {
  return (
    <section
      aria-labelledby={idTitulo}
      className={cn("scroll-mt-4", className)}
      {...props}
    >
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        {/* Tile e título juntos, sem quebrar um do outro: no celular o
            título longo quebra em duas linhas ao lado do tile. */}
        <div className="flex min-w-0 items-center gap-3">
          {icone ? (
            <TileIcone
              tom={semTom ? "branco" : tom}
              forma="quadrado"
              className={semTom ? "border-linha border" : undefined}
            >
              {icone}
            </TileIcone>
          ) : null}
          <Titulo
            id={idTitulo}
            className="font-titulo text-2 text-texto min-w-0 font-medium"
          >
            {titulo}
            {contagem !== undefined ? (
              <span className="rounded-pilula bg-areia text-apoio text-texto ml-2 inline-flex min-h-7 min-w-7 items-center justify-center px-2 align-middle font-mono font-medium tabular-nums">
                <span className="sr-only">, </span>
                {contagem}
              </span>
            ) : null}
          </Titulo>
        </div>
        {lateral ? (
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {lateral}
          </div>
        ) : null}
      </div>
      {apoio ? (
        <p className="text-apoio text-texto-2 -mt-1 mb-3 max-w-[62ch]">
          {apoio}
        </p>
      ) : null}
      {children}
    </section>
  );
}
