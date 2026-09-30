import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Anel segmentado (DESIGN.md, 2.8; dataviz, "arco segmentado"): um
 * segmento por passo real (as etapas da visita), feito em marinho, atual
 * em dourado, a fazer na trilha. Substitui a rosca contínua e o anel
 * decorativo: cada segmento é uma coisa que a pessoa faz.
 *
 * Decorativo para o leitor de tela (`aria-hidden`): quem usa põe a frase
 * ao lado ou no `centro` ("3 de 8"). O dourado do atual mede 2,5:1 no
 * creme, como a borda de "hoje" da régua; por isso o anel nunca carrega o
 * significado sozinho.
 */
export type EstadoSegmento = "feito" | "atual" | "futuro";

export interface AnelProgressoProps {
  segmentos: readonly EstadoSegmento[];
  /** Lado em px. Padrão 72. */
  tamanho?: number;
  /** Espessura do traço em px. Padrão 7. */
  espessura?: number;
  /** Conteúdo no centro (número em Jost). */
  centro?: React.ReactNode;
  /** Trilha dos segmentos a fazer: neutra (sobre creme e branco) ou dourada (dentro do bloco dourado). */
  trilha?: "neutra" | "dourada";
  className?: string;
}

const COR: Record<EstadoSegmento, string> = {
  feito: "stroke-marinho",
  atual: "stroke-dourado",
  futuro: "",
};

export function AnelProgresso({
  segmentos,
  tamanho = 72,
  espessura = 7,
  centro,
  trilha = "neutra",
  className,
}: AnelProgressoProps) {
  const n = Math.max(segmentos.length, 1);
  const raio = (tamanho - espessura) / 2;
  const circunferencia = 2 * Math.PI * raio;
  // Folga entre segmentos: a ponta redonda come metade da espessura de
  // cada lado, então a folga visível é a espessura mais 4 px.
  const folga = n > 1 ? ((espessura + 4) / circunferencia) * 360 : 0;
  const passo = 360 / n;
  const comprimento = Math.max(passo - folga, 0.5);
  const corTrilha =
    trilha === "dourada" ? "stroke-dourado-medio" : "stroke-marinho-14";

  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center",
        className,
      )}
      style={{ width: tamanho, height: tamanho }}
    >
      <svg
        width={tamanho}
        height={tamanho}
        viewBox={`0 0 ${tamanho} ${tamanho}`}
        className="-rotate-90"
        fill="none"
      >
        {segmentos.map((estado, i) => (
          <circle
            key={i}
            cx={tamanho / 2}
            cy={tamanho / 2}
            r={raio}
            pathLength={360}
            strokeWidth={espessura}
            strokeLinecap="round"
            strokeDasharray={`${comprimento} ${360 - comprimento}`}
            strokeDashoffset={-(i * passo + folga / 2)}
            data-estado={estado}
            className={cn(
              estado === "futuro" ? corTrilha : COR[estado],
              "ease-estado transition-[stroke] duration-220",
            )}
          />
        ))}
      </svg>
      {centro ? (
        <span className="absolute inset-0 flex items-center justify-center">
          {centro}
        </span>
      ) : null}
    </span>
  );
}
