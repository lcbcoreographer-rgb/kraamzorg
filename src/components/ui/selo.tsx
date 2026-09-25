import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Selo de estado (DESIGN.md, seção 6). Pílula de 28 px, 13 px em 600, ícone
 * de 16 quando o estado é de risco. Sempre com texto (nunca só ícone ou só
 * cor). `sensivel` é ameixa, nunca vermelho (luto e intercorrência não são
 * erro). `destaque` (dourado com texto marinho) só para "Oferta pendente" e
 * "Quente" (DESIGN.md, seção 4: regra de um acento dourado por tela).
 */
const seloVariantes = cva(
  "inline-flex min-h-[28px] items-center gap-1.5 rounded-pilula px-3 text-mini leading-none font-semibold whitespace-nowrap",
  {
    variants: {
      variante: {
        neutro: "bg-marinho-08 text-texto",
        sucesso: "bg-sucesso-lavado text-sucesso",
        aviso: "bg-aviso-lavado text-aviso-texto",
        alerta: "bg-alerta-lavado text-alerta",
        sensivel: "bg-sensivel-lavado text-sensivel",
        marinho: "bg-marinho text-texto-inverso",
        destaque: "bg-dourado text-marinho",
        contorno: "border-[1.5px] border-dashed border-marinho-50 bg-transparent text-texto-2",
      },
    },
    defaultVariants: { variante: "neutro" },
  },
);

export interface SeloProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof seloVariantes> {
  icone?: React.ReactNode;
}

export function Selo({ variante, icone, className, children, ...props }: SeloProps) {
  return (
    <span className={cn(seloVariantes({ variante }), className)} {...props}>
      {icone ? (
        <span className="[&>svg]:size-4" aria-hidden="true">
          {icone}
        </span>
      ) : null}
      {children}
    </span>
  );
}
