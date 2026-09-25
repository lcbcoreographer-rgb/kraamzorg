import * as React from "react";
import { Hand } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Botão de freio (DESIGN.md, seção 6; PRD 20.4, "Botão de freio em um toque
 * no cabeçalho da família"). Não é uma variante de `Botao`: muda de forma
 * (contorno ameixa, não pílula preenchida) e de regra (um toque, sem
 * confirmação nenhuma, porque o freio precisa agir na hora). Fica no
 * cabeçalho de toda tela da família.
 */
export interface BotaoFreioProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "children"
> {
  /** Rótulo visível ao lado do ícone (ex: "Freio"). */
  children: React.ReactNode;
  /** Rótulo acessível completo (ex: "Acionar freio: pausa toda mensagem automática para esta família"). */
  "aria-label": string;
}

export const BotaoFreio = React.forwardRef<HTMLButtonElement, BotaoFreioProps>(
  ({ className, children, type = "button", ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          "min-h-toque rounded-pilula border-sensivel text-sensivel ease-estado hover:bg-sensivel-lavado inline-flex items-center gap-2 border-[1.5px] bg-transparent px-4 font-semibold transition-colors duration-140",
          className,
        )}
        {...props}
      >
        <Hand className="size-[18px]" aria-hidden="true" />
        <span>{children}</span>
      </button>
    );
  },
);
BotaoFreio.displayName = "BotaoFreio";
