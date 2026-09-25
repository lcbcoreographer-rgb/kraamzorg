import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Cartão (DESIGN.md, seção 6). Branco, raio 20, sombra-1, padding 20.
 * Cartão tocável inteiro é link (ou botão, quando a ação não navega).
 * Nunca cartão dentro de cartão.
 */
export interface CartaoProps extends React.HTMLAttributes<HTMLDivElement> {
  variante?: "padrao" | "plano" | "areia";
  /** Torna o cartão inteiro um alvo tocável (link ou botão). */
  tocavel?: boolean;
  /** Presente + `tocavel`: renderiza `<a href=...>` em vez de `<button>`. */
  href?: string;
}

const classesVariante: Record<NonNullable<CartaoProps["variante"]>, string> = {
  padrao: "bg-superficie shadow-1",
  plano: "bg-superficie border border-linha",
  areia: "bg-superficie-2",
};

export const Cartao = React.forwardRef<HTMLDivElement, CartaoProps>(
  (
    {
      variante = "padrao",
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
