import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Base das ilustrações da casa (PRD 20.2 [v4.4]; DESIGN.md, 2.10, 2.11 e
 * 5.1). Desenho próprio, feito à mão em SVG: traço contínuo e arredondado
 * em marinho, com a espessura dos ícones (1,75 px na tela, em qualquer
 * tamanho), e preenchimento chapado em dourado e tons de apoio, levemente
 * fora do traço, como um carimbo. Cor só por token (`stroke-marinho`,
 * `fill-dourado-claro`...), nunca hexadecimal.
 *
 * Só em estado vazio e na comemoração do checklist completo. Nunca em
 * alerta clínico, perda, freio ou intercorrência.
 *
 * Acessibilidade: com `titulo`, o SVG vira `role="img"` com `<title>`;
 * sem título, é decorativo (`aria-hidden`), porque o texto ao lado já diz
 * tudo. `animar` desenha o traço uma vez (700 ms) e faz os preenchimentos
 * surgirem; com `prefers-reduced-motion`, a regra de `globals.css` zera a
 * duração e a ilustração aparece pronta.
 */
export type TomIlustracao =
  | "dourado"
  | "dourado-claro"
  | "dourado-medio"
  | "areia-clara"
  | "salvia-clara"
  | "salvia-media"
  | "lavanda-clara"
  | "lavanda-media"
  | "argila-clara"
  | "argila-media"
  | "branco";

const PREENCHIMENTO: Record<TomIlustracao, string> = {
  dourado: "fill-dourado",
  "dourado-claro": "fill-dourado-claro",
  "dourado-medio": "fill-dourado-medio",
  "areia-clara": "fill-areia-clara",
  "salvia-clara": "fill-salvia-clara",
  "salvia-media": "fill-salvia-media",
  "lavanda-clara": "fill-lavanda-clara",
  "lavanda-media": "fill-lavanda-media",
  "argila-clara": "fill-argila-clara",
  "argila-media": "fill-argila-media",
  branco: "fill-branco",
};

export interface IlustracaoProps {
  /** Texto para o leitor de tela. Sem ele, a ilustração é decorativa. */
  titulo?: string;
  /** Lado, em px (a ilustração é quadrada). Padrão 120. */
  tamanho?: number;
  /** Desenha o traço uma vez (comemoração). */
  animar?: boolean;
  className?: string;
}

export function Ilustracao({
  titulo,
  tamanho = 120,
  animar = false,
  className,
  children,
}: IlustracaoProps & { children: React.ReactNode }) {
  const id = React.useId();
  return (
    <svg
      viewBox="0 0 120 120"
      width={tamanho}
      height={tamanho}
      fill="none"
      role={titulo ? "img" : undefined}
      aria-hidden={titulo ? undefined : true}
      aria-labelledby={titulo ? `${id}-titulo` : undefined}
      focusable="false"
      data-animar={animar ? "true" : undefined}
      className={cn("group/ilustracao shrink-0 overflow-visible", className)}
    >
      {titulo ? <title id={`${id}-titulo`}>{titulo}</title> : null}
      {children}
    </svg>
  );
}

/**
 * Traço em marinho, 1,75 px na tela em qualquer tamanho. `pathLength` 1 e
 * traço de 1: parado, é a linha inteira; com `animar`, o deslocamento vai
 * de 1 a 0 e a linha se desenha. `tracejado` vira pontilhado de pontos
 * redondos (sinal fraco, costura) e não anima.
 */
export function Traco({
  d,
  atraso = 0,
  tracejado = false,
}: {
  d: string;
  /** Atraso da animação, em ms, para desenhar em sequência. */
  atraso?: number;
  tracejado?: boolean;
}) {
  return (
    <path
      d={d}
      pathLength={tracejado ? undefined : 1}
      strokeDasharray={tracejado ? "0.5 4.5" : "1"}
      className={cn(
        "stroke-marinho",
        !tracejado && "group-data-[animar=true]/ilustracao:animate-desenhar",
      )}
      style={atraso ? { animationDelay: `${atraso}ms` } : undefined}
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      vectorEffect="non-scaling-stroke"
      fill="none"
    />
  );
}

/** Forma chapada num tom da marca, sem traço. Surge com `animar`. */
export function Forma({
  d,
  tom,
  atraso = 0,
}: {
  d: string;
  tom: TomIlustracao;
  atraso?: number;
}) {
  return (
    <path
      d={d}
      className={cn(
        PREENCHIMENTO[tom],
        "origin-center [transform-box:fill-box]",
        "group-data-[animar=true]/ilustracao:animate-surgir",
      )}
      style={atraso ? { animationDelay: `${atraso}ms` } : undefined}
    />
  );
}
