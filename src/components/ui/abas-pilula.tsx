import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Abas em pílula (DESIGN.md, 2.9; referência: "Weekly / Month" e
 * "Creator / Collector"). Trilha areia com a aba ativa numa pílula marinho
 * com texto creme [polimento: antes branca, sumia no areia]; 44 px de alvo. Serve para trocar de visão dentro da
 * mesma tela (pipeline 1 e 2, período, filtro rápido).
 *
 * Cada aba é um link (`href`, navega e o estado mora na URL) ou um botão
 * (`aoEscolher`). Semântica de `tablist` com `aria-selected`, como as abas
 * de antes, para o leitor de tela e para os testes.
 */
export interface AbaPilula {
  valor: string;
  rotulo: React.ReactNode;
  href?: string;
  /** Contagem opcional ao lado do rótulo, em mono. */
  contador?: number;
}

export interface AbasPilulaProps {
  abas: AbaPilula[];
  ativa: string;
  /** Nome acessível da lista de abas ("Pipelines"). */
  rotulo: string;
  aoEscolher?: (valor: string) => void;
  /**
   * Ocupa a largura toda, abas do mesmo tamanho e rótulo que pode quebrar
   * em duas linhas. "celular": só abaixo de 600 px; acima, volta ao tamanho
   * do conteúdo.
   */
  larga?: boolean | "celular";
  className?: string;
}

export function AbasPilula({
  abas,
  ativa,
  rotulo,
  aoEscolher,
  larga = false,
  className,
}: AbasPilulaProps) {
  return (
    <div
      role="tablist"
      aria-label={rotulo}
      className={cn(
        "rounded-pilula bg-areia inline-flex max-w-full gap-1 overflow-x-auto p-1",
        larga === true && "flex w-full",
        larga === "celular" && "tablet:inline-flex tablet:w-auto flex w-full",
        className,
      )}
    >
      {abas.map((aba) => {
        const selecionada = aba.valor === ativa;
        const classes = cn(
          "min-h-toque rounded-pilula text-apoio ease-estado inline-flex items-center justify-center gap-2 px-4 font-semibold no-underline transition-[background-color,box-shadow,color] duration-140",
          larga === true && "flex-1 py-1.5 text-center leading-tight",
          larga === "celular" &&
            "tablet:flex-none tablet:whitespace-nowrap flex-1 py-1.5 text-center leading-tight",
          !larga && "whitespace-nowrap",
          selecionada
            ? "bg-marinho text-texto-inverso shadow-1"
            : "text-texto-2 hover:bg-areia-clara hover:text-texto",
        );
        const conteudo = (
          <>
            {aba.rotulo}
            {aba.contador !== undefined ? (
              <span className="text-mini font-mono font-medium">
                {aba.contador}
              </span>
            ) : null}
          </>
        );
        return aba.href ? (
          <Link
            key={aba.valor}
            href={aba.href}
            role="tab"
            aria-selected={selecionada}
            className={classes}
          >
            {conteudo}
          </Link>
        ) : (
          <button
            key={aba.valor}
            type="button"
            role="tab"
            aria-selected={selecionada}
            onClick={() => aoEscolher?.(aba.valor)}
            className={classes}
          >
            {conteudo}
          </button>
        );
      })}
    </div>
  );
}
