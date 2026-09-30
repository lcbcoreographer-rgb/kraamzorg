import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Navegação inferior em pílula (DESIGN.md, 2.9; PRD 20.4; referência: a
 * barra escura em pílula do app de estudos). Pílula marinho flutuante de
 * 64 px, a 8 px das laterais e a 12 px do fundo, com sombra leve. Com
 * cinco abas em 390 px, cada uma tem 71 px: cabe "Conversas" e
 * "Financeiro" em 13 px sem cortar. Todas as abas
 * mostram ícone (22 px) e rótulo (13 px); a ativa vira uma pílula creme
 * com ícone e rótulo em marinho. Contador em alerta só para alerta clínico
 * ou transferência vencendo.
 *
 * Este componente é estático (sem papel): os itens vêm sempre por
 * propriedade. A navegação por papel é da casca do app. A visibilidade por
 * tamanho de tela mora na casca (`visivelEm`), para a vitrine do design
 * system poder mostrar a navegação em qualquer largura.
 *
 * A altura ocupada (pílula mais a folga) é `--altura-abas`: o conteúdo e a
 * barra de ação do checklist sobem essa altura.
 */
export interface ItemAbaInferior {
  rotulo: string;
  href: string;
  icone: React.ReactNode;
  ativo?: boolean;
  /** Contador em destaque (alerta clínico, transferência vencendo). */
  contador?: number;
  /** Rótulo completo do contador para o leitor de tela (ex: "2 alertas"). Sem isto, "Alertas" e "2" viram um nome acessível só "Alertas2". */
  rotuloContador?: string;
}

export interface AbasInferioresProps {
  itens: ItemAbaInferior[];
  /** Rótulo acessível da navegação (ex: "Navegação principal"). */
  rotulo: string;
  /** Quando mostrar as abas: "sempre" (padrão) ou só até o tablet. */
  visivelEm?: "sempre" | "celular";
  /** "fixa" (padrão) no rodapé da tela; "solta" dentro do fluxo (vitrine). */
  posicao?: "fixa" | "solta";
  className?: string;
}

export function AbasInferiores({
  itens,
  rotulo,
  visivelEm = "sempre",
  posicao = "fixa",
  className,
}: AbasInferioresProps) {
  return (
    <nav
      aria-label={rotulo}
      className={cn(
        "rounded-pilula bg-marinho shadow-2 grid auto-cols-fr grid-flow-col gap-0.5 p-1",
        posicao === "fixa" &&
          "fixed inset-x-2 z-[var(--z-barra)] mx-auto max-w-[480px]",
        visivelEm === "celular" && "lg:hidden",
        className,
      )}
      style={
        posicao === "fixa"
          ? { bottom: "calc(12px + env(safe-area-inset-bottom))" }
          : undefined
      }
    >
      {itens.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.ativo ? "page" : undefined}
          className={cn(
            "rounded-pilula text-mini ease-estado relative flex min-h-[56px] min-w-0 flex-col items-center justify-center gap-0.5 px-0 font-medium tracking-[-0.01em] no-underline transition-[background-color,color] duration-140",
            item.ativo
              ? "bg-creme text-marinho font-semibold"
              : "text-texto-inverso-2 hover:bg-lateral-hover hover:text-texto-inverso",
          )}
        >
          <span className="[&>svg]:size-[22px]">{item.icone}</span>
          <span className="max-w-full truncate">{item.rotulo}</span>
          {item.contador ? (
            <span
              aria-hidden="true"
              className="rounded-pilula bg-alerta text-texto-inverso text-mini ring-marinho absolute top-0.5 left-[calc(50%+4px)] flex h-5 min-w-5 items-center justify-center px-1.5 font-mono leading-5 ring-2"
            >
              {item.contador}
            </span>
          ) : null}
          {item.contador && item.rotuloContador ? (
            <span className="sr-only">, {item.rotuloContador}</span>
          ) : null}
        </Link>
      ))}
    </nav>
  );
}
