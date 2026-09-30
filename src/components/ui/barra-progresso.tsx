import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Barra de progresso em pílula (DESIGN.md, 2.8; referência: a barra gorda
 * do quiz). Trilha de 10 px e preenchimento marinho com a ponta redonda,
 * com a frase ao lado ("5 de 9 respondidas"). Completa, ganha o check.
 *
 * A frase é o que o leitor de tela lê; a barra é `aria-hidden`. Sem
 * animação de entrada: o preenchimento só anda quando a pessoa responde
 * (220 ms), e para.
 */
export interface BarraProgressoProps {
  valor: number;
  total: number;
  /** Frase visível ("5 de 9 respondidas"). */
  texto: React.ReactNode;
  /** Frase quando completa ("Tudo respondido nesta etapa"). */
  textoCompleta?: React.ReactNode;
  /** Trilha neutra (sobre creme e branco) ou dourada (dentro do bloco dourado). */
  trilha?: "neutra" | "dourada";
  className?: string;
}

export function BarraProgresso({
  valor,
  total,
  texto,
  textoCompleta,
  trilha = "neutra",
  className,
}: BarraProgressoProps) {
  const fracao = total > 0 ? Math.min(Math.max(valor / total, 0), 1) : 0;
  const completa = total > 0 && valor >= total;
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div
        aria-hidden="true"
        className={cn(
          "rounded-pilula h-2.5 w-full overflow-hidden",
          trilha === "dourada" ? "bg-dourado-medio" : "bg-marinho-14",
        )}
      >
        <div
          className="rounded-pilula bg-marinho ease-estado h-full transition-[width] duration-220"
          style={{
            width: fracao > 0 ? `max(10px, ${fracao * 100}%)` : 0,
          }}
        />
      </div>
      <p className="text-apoio text-texto flex items-center gap-2 font-medium">
        {completa ? (
          <span className="rounded-pilula bg-salvia-media inline-flex size-5 items-center justify-center">
            <Check className="size-3.5" strokeWidth={2.25} aria-hidden="true" />
          </span>
        ) : null}
        <span>{completa && textoCompleta ? textoCompleta : texto}</span>
      </p>
    </div>
  );
}
