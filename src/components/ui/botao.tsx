import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Botão (DESIGN.md, seção 6). Pílula de 48 px, texto de 16 px em 600, verbo
 * e objeto no rótulo ("Assinar registro do D4"). Primário marinho; secundário
 * branco com borda; perigo só dentro de faixa clínica ("Ligar para a
 * supervisão"); fantasma é o terciário sublinhado. Um primário por tela.
 *
 * O botão de freio (marinho para ameixa) tem componente próprio: não é uma
 * variante deste, porque muda de forma (contorno) e de regra (um toque, sem
 * pergunta), não só de cor.
 */
const botaoVariantes = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-pilula border-[1.5px] font-sans font-semibold leading-tight transition-[background-color,transform,border-color] duration-140 ease-estado active:translate-y-px active:scale-[0.985] disabled:cursor-not-allowed disabled:border-linha disabled:bg-marinho-08 disabled:text-texto-3 disabled:active:translate-y-0 disabled:active:scale-100 aria-disabled:cursor-not-allowed aria-disabled:border-linha aria-disabled:bg-marinho-08 aria-disabled:text-texto-3",
  {
    variants: {
      variante: {
        primario:
          "border-acao bg-acao text-acao-texto hover:border-acao-hover hover:bg-acao-hover",
        secundario:
          "border-borda-campo bg-superficie text-texto hover:bg-marinho-08",
        perigo:
          "border-alerta bg-alerta text-texto-inverso hover:bg-[color-mix(in_srgb,var(--alerta)_86%,var(--marinho))]",
        fantasma:
          "border-transparent bg-transparent text-texto underline decoration-1 underline-offset-4 hover:bg-marinho-08",
      },
      tamanho: {
        padrao: "min-h-12 px-6 text-corpo",
        compacto: "min-h-toque px-4 text-apoio",
      },
      largaTotal: {
        true: "w-full",
        false: "",
      },
    },
    compoundVariants: [
      { variante: "fantasma", tamanho: "padrao", class: "px-3" },
      { variante: "fantasma", tamanho: "compacto", class: "px-3" },
    ],
    defaultVariants: {
      variante: "primario",
      tamanho: "padrao",
      largaTotal: false,
    },
  },
);

export interface BotaoProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof botaoVariantes> {
  /** Renderiza como o filho (ex: um `<a>`), no padrão do Radix Slot. */
  asChild?: boolean;
  /** Ícone antes do rótulo. Decorativo: o rótulo já diz o que o botão faz. */
  iconeEsquerda?: React.ReactNode;
  /** Ícone depois do rótulo. */
  iconeDireita?: React.ReactNode;
  /** `aria-busy`, gira o ícone e troca o rótulo pelo gerúndio (DESIGN.md). */
  carregando?: boolean;
  /** Rótulo mostrado enquanto `carregando` é verdadeiro (ex: "Assinando"). */
  rotuloCarregando?: React.ReactNode;
}

export const Botao = React.forwardRef<HTMLButtonElement, BotaoProps>(
  (
    {
      className,
      variante,
      tamanho,
      largaTotal,
      asChild = false,
      iconeEsquerda,
      iconeDireita,
      carregando = false,
      rotuloCarregando,
      type = "button",
      disabled,
      children,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : "button";

    return (
      <Comp
        ref={ref}
        type={asChild ? undefined : type}
        className={cn(
          botaoVariantes({ variante, tamanho, largaTotal }),
          className,
        )}
        disabled={disabled || carregando}
        aria-busy={carregando || undefined}
        {...props}
      >
        {carregando ? (
          <LoaderCircle
            className="size-[1.1em] shrink-0 animate-spin"
            aria-hidden="true"
          />
        ) : (
          iconeEsquerda
        )}
        <span>{carregando ? (rotuloCarregando ?? children) : children}</span>
        {!carregando ? iconeDireita : null}
      </Comp>
    );
  },
);
Botao.displayName = "Botao";
