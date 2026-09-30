import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Cabeçalho das telas que abrem o dia (Hoje da enfermeira, Início de cada
 * papel), direção "Colo" (DESIGN.md, 2.2, 2.5 e 2.13). Um bloco
 * `dourado-claro` em forma colo, com o cumprimento pelo primeiro nome, o
 * dia como título (`h1`, t-display) e a frase de estado em marinho logo
 * abaixo (DESIGN.md 11.4). `children` é o que o dia tem, em números: o
 * trio de cartões-resumo, em branco, dentro do bloco.
 *
 * Não é preso no topo: rola com a página. O título nunca leva nome de
 * família (microcopy 11). Nunca em tela de família em estado sensível.
 */
export function CabecalhoSaudacao({
  saudacao,
  titulo,
  frase,
  lateral,
  children,
  nivelTitulo = "h1",
  className,
}: {
  /** "Bom dia, Talita" (`saudacao()` de ./saudacao). */
  saudacao: string;
  /** O dia: "Hoje, quarta 30/09" ou "Quarta, 30/09". */
  titulo: ReactNode;
  /** Frase de estado do dia. */
  frase?: ReactNode;
  /** O que fica à direita do cumprimento (indicador de sincronização). */
  lateral?: ReactNode;
  children?: ReactNode;
  /** Nível do título (padrão h1; outro nível só na vitrine do design system). */
  nivelTitulo?: "h1" | "h2" | "h3";
  className?: string;
}) {
  const Titulo = nivelTitulo;
  return (
    <header
      className={cn(
        "rounded-colo bg-dourado-claro mt-3 flex flex-col px-5 pt-5 pb-12 lg:mt-6 lg:px-8 lg:pt-7",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <p className="text-3 text-texto font-medium">{saudacao}</p>
        {lateral ? (
          <div className="flex flex-wrap items-center gap-2">{lateral}</div>
        ) : null}
      </div>
      <Titulo className="font-titulo text-display lg:text-display-lg text-texto mt-1 font-normal">
        {titulo}
      </Titulo>
      {frase ? (
        <p className="text-3 text-texto mt-2 max-w-[52ch]">{frase}</p>
      ) : null}
      {children ? <div className="mt-5">{children}</div> : null}
    </header>
  );
}
