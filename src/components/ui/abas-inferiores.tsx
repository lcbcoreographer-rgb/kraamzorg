import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Abas inferiores (DESIGN.md, seção 6; PRD 20.4). Navegação do celular e do
 * tablet, 4 ou 5 itens, 56 px, ícone 24 e rótulo 13. Ativa em marinho 600
 * com marca dourada de 3 px em cima. Contador em alerta só para alerta
 * clínico ou transferência vencendo.
 *
 * Este componente é estático (sem papel): os itens vêm sempre por
 * propriedade. A navegação por papel (quais abas cada papel vê) é da casca
 * do app, depois do P07.
 *
 * A visibilidade por tamanho de tela (`lg:hidden`) não mora mais aqui: a
 * casca decide isso (`visivelEm`), pelo mesmo motivo de `BarraLateral`
 * (achado da auditoria da P10 parcial: caixa vazia em 1280 na vitrine).
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
  className?: string;
}

export function AbasInferiores({
  itens,
  rotulo,
  visivelEm = "sempre",
  className,
}: AbasInferioresProps) {
  return (
    <nav
      aria-label={rotulo}
      className={cn(
        "border-linha bg-superficie fixed inset-x-0 bottom-0 z-20 grid auto-cols-fr grid-flow-col border-t px-2 py-1",
        visivelEm === "celular" && "lg:hidden",
        className,
      )}
      style={{ paddingBottom: "calc(4px + env(safe-area-inset-bottom))" }}
    >
      {itens.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.ativo ? "page" : undefined}
          className={cn(
            "rounded-2 text-mini text-texto-2 relative flex min-h-14 flex-col items-center justify-center gap-0.5 font-medium no-underline",
            item.ativo && "text-texto font-semibold",
          )}
        >
          {item.ativo ? (
            <span
              aria-hidden="true"
              className="rounded-b-1 bg-destaque absolute top-0 left-1/2 h-[3px] w-7 -translate-x-1/2"
            />
          ) : null}
          <span className="[&>svg]:size-6">{item.icone}</span>
          <span>{item.rotulo}</span>
          {item.contador ? (
            <span
              aria-hidden="true"
              className="rounded-pilula bg-alerta text-texto-inverso text-mini absolute top-1 left-[calc(50%+6px)] flex h-5 min-w-5 items-center justify-center px-1.5 font-mono leading-5"
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
