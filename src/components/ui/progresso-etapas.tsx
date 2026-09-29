import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Progresso em blocos (DESIGN.md, seções 2 e 6, família `blocos` da régua
 * de dias): as etapas feitas em marinho, a atual com a borda dourada de
 * "hoje" e as seguintes tracejadas ("ainda não"). Substitui a barra de
 * biblioteca, que está na lista de recusas (DESIGN.md, seção 8).
 *
 * Até 12 etapas, um bloco por etapa. Acima disso, um bloco por seção do
 * instrumento (a parte do id antes do primeiro ponto: "2.1" a "2.13" são a
 * seção "2"), com largura proporcional ao número de etapas da seção.
 * Decorativo para o leitor de tela: a frase "Etapa 3 de 26" ao lado já diz
 * o mesmo, com `aria-live`.
 */
export interface ProgressoEtapasProps {
  /** Ids das etapas visíveis, na ordem. */
  etapas: readonly string[];
  /** Índice da etapa atual (0 a etapas.length - 1). */
  atual: number;
  className?: string;
}

const LIMITE_UM_POR_ETAPA = 12;

interface Segmento {
  chave: string;
  inicio: number;
  tamanho: number;
}

export function segmentosDoProgresso(etapas: readonly string[]): Segmento[] {
  if (etapas.length <= LIMITE_UM_POR_ETAPA) {
    return etapas.map((id, i) => ({ chave: id, inicio: i, tamanho: 1 }));
  }
  const segmentos: Segmento[] = [];
  etapas.forEach((id, i) => {
    const secao = id.split(".")[0] ?? id;
    const ultimo = segmentos.at(-1);
    if (ultimo && ultimo.chave === secao) ultimo.tamanho += 1;
    else segmentos.push({ chave: secao, inicio: i, tamanho: 1 });
  });
  return segmentos;
}

export function ProgressoEtapas({
  etapas,
  atual,
  className,
}: ProgressoEtapasProps) {
  const segmentos = segmentosDoProgresso(etapas);
  return (
    <div aria-hidden="true" className={cn("flex w-full gap-[3px]", className)}>
      {segmentos.map((s) => {
        const fim = s.inicio + s.tamanho - 1;
        const estado =
          atual > fim ? "feito" : atual >= s.inicio ? "atual" : "futuro";
        return (
          <span
            key={`${s.chave}-${s.inicio}`}
            data-estado={estado}
            style={{ flexGrow: s.tamanho, flexBasis: 0 }}
            className={cn(
              "rounded-pilula block min-h-[10px] min-w-2",
              estado === "feito" && "bg-marinho border-marinho border",
              estado === "atual" &&
                "bg-superficie border-dourado shadow-anel-hoje border-2",
              estado === "futuro" &&
                "border-marinho-50 border-[1.5px] border-dashed bg-transparent",
            )}
          />
        );
      })}
    </div>
  );
}
