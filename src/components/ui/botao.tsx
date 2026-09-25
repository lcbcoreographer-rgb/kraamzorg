"use client";

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
  "inline-flex items-center justify-center gap-2 rounded-pilula border-[1.5px] font-sans font-semibold leading-tight transition-[background-color,transform,border-color] duration-140 ease-estado active:translate-y-px active:scale-[0.985] disabled:cursor-not-allowed disabled:border-linha disabled:bg-marinho-08 disabled:text-texto-3 disabled:active:translate-y-0 disabled:active:scale-100 aria-disabled:cursor-not-allowed aria-disabled:border-linha aria-disabled:bg-marinho-08 aria-disabled:text-texto-3",
  {
    variants: {
      variante: {
        primario:
          "border-acao bg-acao text-acao-texto hover:border-acao-hover hover:bg-acao-hover",
        secundario:
          "border-borda-campo bg-superficie text-texto hover:bg-marinho-08",
        perigo:
          "border-alerta bg-alerta text-texto-inverso hover:bg-alerta-hover",
        fantasma:
          "border-transparent bg-transparent text-texto underline decoration-1 underline-offset-4 hover:bg-marinho-08",
        /** Confirmação do freio dentro de um diálogo (não é o botão de
         *  freio em si: para isso existe `BotaoFreio`, contorno ameixa,
         *  um toque sem confirmação, DESIGN.md seção 6). */
        sensivel:
          "border-sensivel bg-sensivel text-texto-inverso hover:bg-sensivel-lavado hover:text-sensivel",
        /** Só ícone, 44×44. O `aria-label` é obrigatório (tipo exige). */
        icone:
          "border-transparent bg-transparent text-texto-2 hover:bg-marinho-08",
      },
      tamanho: {
        padrao: "min-h-12 px-6 text-corpo",
        compacto: "min-h-toque px-4 text-apoio",
      },
      largaTotal: {
        true: "w-full whitespace-normal text-balance",
        false: "whitespace-nowrap",
      },
    },
    compoundVariants: [
      { variante: "fantasma", tamanho: "padrao", class: "px-3" },
      { variante: "fantasma", tamanho: "compacto", class: "px-3" },
      { variante: "icone", class: "size-toque shrink-0 p-0" },
    ],
    defaultVariants: {
      variante: "primario",
      tamanho: "padrao",
      largaTotal: false,
    },
  },
);

interface BotaoPropsComuns
  extends
    Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "aria-label">,
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

/**
 * `variante="icone"` (44×44, só ícone) exige `aria-label`: sem rótulo
 * visível, é o único jeito de o botão ter nome acessível.
 */
export type BotaoProps =
  | (BotaoPropsComuns & { variante: "icone"; "aria-label": string })
  | (BotaoPropsComuns & {
      variante?: Exclude<BotaoPropsComuns["variante"], "icone">;
      "aria-label"?: string;
    });

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
      onClick,
      children,
      ...props
    },
    ref,
  ) => {
    const classe = cn(
      botaoVariantes({ variante, tamanho, largaTotal }),
      className,
    );

    const bloqueado = Boolean(disabled) || carregando;

    // `carregando` usa `aria-disabled`, não `disabled`: um `<button
    // disabled>` sai da árvore de foco na hora, e o foco caía no meio da
    // própria ação que o disparou (achado da auditoria da P10 parcial). O
    // clique continua bloqueado, só que pelo handler abaixo.
    function lidarComClique(evento: React.MouseEvent<HTMLElement>) {
      if (bloqueado) {
        evento.preventDefault();
        evento.stopPropagation();
        return;
      }
      (onClick as React.MouseEventHandler<HTMLElement> | undefined)?.(evento);
    }

    // `asChild` funde as props do botão num único filho (padrão Radix Slot),
    // por exemplo um `<a>` de navegação. O Slot exige exatamente um
    // elemento React, então aqui não dá para envolver o filho em ícone e
    // `<span>` como no `<button>` nativo: quem usa `asChild` controla o
    // próprio conteúdo do filho. Com `asChild` o filho pode ser um `<a>`, que
    // não tem `disabled`: sem bloquear o clique aqui, um link desabilitado
    // continuava navegando (achado da auditoria).
    if (asChild) {
      return (
        <Slot
          ref={ref}
          className={classe}
          aria-busy={carregando || undefined}
          aria-disabled={bloqueado || undefined}
          tabIndex={bloqueado ? -1 : undefined}
          onClick={lidarComClique}
          {...props}
        >
          {children}
        </Slot>
      );
    }

    return (
      <button
        ref={ref}
        type={type}
        className={classe}
        disabled={disabled}
        aria-disabled={carregando || undefined}
        aria-busy={carregando || undefined}
        onClick={lidarComClique}
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
      </button>
    );
  },
);
Botao.displayName = "Botao";
