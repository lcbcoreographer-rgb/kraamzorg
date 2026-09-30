import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Cartão (DESIGN.md, 2.4, 2.5 e seção 6). Raio 28, padding 20.
 *
 * - `padrao`: branco com sombra leve, o trabalho que ainda falta.
 * - `plano`: branco com contorno fino, sem sombra.
 * - `areia`: areia cheia (lugar da família, como o cabeçalho da família).
 * - Tons de apoio [v4.4] (`dourado`, `areia-clara`, `salvia`, `lavanda`,
 *   `argila`): bloco no tom claro do assunto, sem sombra. A cor diz o que o
 *   bloco é, nunca o estado, e nunca aparece em família em estado sensível
 *   (PRD 20.2).
 *
 * `forma="colo"`: a base em arco raso (um por tela, no bloco de abertura).
 * Cartão tocável inteiro é link (ou botão, quando a ação não navega).
 * Nunca cartão branco dentro de cartão branco.
 */
export interface CartaoProps extends React.HTMLAttributes<HTMLDivElement> {
  variante?:
    | "padrao"
    | "plano"
    | "areia"
    | "dourado"
    | "areia-clara"
    | "salvia"
    | "lavanda"
    | "argila";
  forma?: "padrao" | "colo";
  /** Torna o cartão inteiro um alvo tocável (link ou botão). */
  tocavel?: boolean;
  /** Presente + `tocavel`: renderiza `<a href=...>` em vez de `<button>`. */
  href?: string;
}

const classesVariante: Record<NonNullable<CartaoProps["variante"]>, string> = {
  padrao: "bg-superficie shadow-1",
  plano: "bg-superficie border border-linha",
  areia: "bg-superficie-2",
  dourado: "bg-dourado-claro",
  "areia-clara": "bg-areia-clara",
  salvia: "bg-salvia-clara",
  lavanda: "bg-lavanda-clara",
  argila: "bg-argila-clara",
};

export const Cartao = React.forwardRef<HTMLDivElement, CartaoProps>(
  (
    {
      variante = "padrao",
      forma = "padrao",
      tocavel,
      href,
      className,
      children,
      onClick,
      ...props
    },
    ref,
  ) => {
    const classes = cn(
      "rounded-3 p-5 text-left",
      forma === "colo" && "rounded-colo pb-12",
      classesVariante[variante],
      tocavel &&
        "block w-full text-inherit no-underline transition-[box-shadow,transform] duration-140 ease-estado hover:shadow-2 active:scale-[0.99]",
      className,
    );

    if (tocavel && href) {
      return (
        <Link
          ref={ref as unknown as React.Ref<HTMLAnchorElement>}
          href={href}
          className={classes}
          {...(props as Omit<
            React.ComponentPropsWithoutRef<typeof Link>,
            "href" | "className"
          >)}
        >
          {children}
        </Link>
      );
    }

    if (tocavel) {
      return (
        <button
          ref={ref as unknown as React.Ref<HTMLButtonElement>}
          type="button"
          onClick={
            onClick as unknown as React.MouseEventHandler<HTMLButtonElement>
          }
          className={classes}
          {...(props as React.ButtonHTMLAttributes<HTMLButtonElement>)}
        >
          {children}
        </button>
      );
    }

    return (
      <div ref={ref} className={classes} onClick={onClick} {...props}>
        {children}
      </div>
    );
  },
);
Cartao.displayName = "Cartao";

export function CartaoTopo({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-start gap-3", className)} {...props} />;
}

export function CartaoAcao({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("ml-auto", className)} {...props} />;
}
