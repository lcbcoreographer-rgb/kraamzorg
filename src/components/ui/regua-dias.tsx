import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Régua de dias (DESIGN.md, seção 2 e 6): a forma assinatura da direção
 * "Caderneta de visita". Um segmento por dia, "D4" em mono e a data curta.
 * Toda noção de tempo do produto herda desta forma (acompanhamento D1 a
 * D12, progresso do checklist, semana da equipe, prazo de SLA).
 */
export type EstadoDia =
  "feito" | "hoje" | "pendente" | "futuro" | "alerta" | "sensivel";

export interface DiaRegua {
  numero: number;
  /** Data curta já formatada por quem chama (ex: "24/09"). */
  rotuloData?: string;
  estado: EstadoDia;
}

export interface ReguaDiasProps {
  dias: DiaRegua[];
  /** Rótulo acessível da régua inteira (ex: "Acompanhamento, D1 a D12"). */
  rotulo: string;
  /** Versão fina (10 px), sem número nem data, para linha de lista e cartão. */
  fina?: boolean;
  className?: string;
}

const classePorEstado: Record<EstadoDia, string> = {
  feito: "bg-marinho border-marinho text-texto-inverso",
  hoje: "bg-superficie border-2 border-dourado text-texto shadow-[0_0_0_3px_var(--dourado-lavado)]",
  pendente:
    "border-[1.5px] border-aviso-borda text-aviso-texto bg-[repeating-linear-gradient(135deg,var(--aviso-lavado)_0_5px,var(--superficie)_5px_9px)]",
  futuro:
    "border-[1.5px] border-dashed border-marinho-50 text-texto-2 bg-transparent",
  alerta: "border-[1.5px] border-alerta text-alerta bg-alerta-lavado",
  sensivel: "border-[1.5px] border-sensivel text-sensivel bg-sensivel-lavado",
};

export function ReguaDias({ dias, rotulo, fina, className }: ReguaDiasProps) {
  return (
    <ol
      aria-label={rotulo}
      className={cn("grid gap-1", fina && "gap-[3px]", className)}
      style={{
        gridTemplateColumns: fina
          ? `repeat(${dias.length}, minmax(0, 1fr))`
          : "repeat(auto-fit, minmax(52px, 1fr))",
      }}
    >
      {dias.map((dia) => (
        <li
          key={dia.numero}
          className={cn(
            "rounded-2 flex flex-col items-center justify-center font-mono tabular-nums",
            fina
              ? "rounded-pilula min-h-[10px] border"
              : "min-h-12 gap-0 border py-1",
            classePorEstado[dia.estado],
          )}
          aria-current={dia.estado === "hoje" ? "date" : undefined}
        >
          {!fina ? (
            <>
              <span
                className={cn(
                  "text-apoio leading-tight",
                  dia.estado === "hoje" && "font-semibold",
                )}
              >
                D{dia.numero}
              </span>
              {dia.rotuloData ? (
                <span className="text-[11px] leading-tight opacity-90">
                  {dia.rotuloData}
                </span>
              ) : null}
            </>
          ) : (
            <span className="sr-only">
              D{dia.numero}
              {dia.rotuloData ? `, ${dia.rotuloData}` : ""}
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}
