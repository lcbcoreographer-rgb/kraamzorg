"use client";

import * as React from "react";
import { CircleAlert } from "lucide-react";
import { classeCaixaPorEstado } from "@/components/ui/campo";
import { cn } from "@/lib/utils";

/**
 * Campo das superfícies da família (DESIGN.md 11.4 e 11.9): a mesma caixa
 * do CampoTexto da equipe (raio, borda, foco e estados de campo.tsx), com
 * a pergunta em `text-3` peso 500 e nada abaixo de 16 px. Rótulo sempre em
 * cima, "(opcional)" escrito, nenhum asterisco. A ajuda diz em uma linha
 * por que o dado é pedido; o erro diz o que fazer e fica junto da ajuda,
 * sem apagar o que foi digitado.
 */
export interface CampoFamiliaProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "onChange" | "value" | "id" | "name"
> {
  nome: string;
  rotulo: React.ReactNode;
  valor: string;
  onMudar: (valor: string) => void;
  ajuda?: React.ReactNode;
  erro?: string;
  opcional?: boolean;
  containerClassName?: string;
}

export function idDoCampo(nome: string): string {
  return `campo-${nome.replace(/\./g, "-")}`;
}

export const CampoFamilia = React.forwardRef<
  HTMLInputElement,
  CampoFamiliaProps
>(
  (
    {
      nome,
      rotulo,
      valor,
      onMudar,
      ajuda,
      erro,
      opcional,
      containerClassName,
      className,
      ...props
    },
    ref,
  ) => {
    const id = idDoCampo(nome);
    const idAjuda = `${id}-ajuda`;
    const idErro = `${id}-erro`;
    const descrevePor =
      [ajuda ? idAjuda : null, erro ? idErro : null]
        .filter(Boolean)
        .join(" ") || undefined;

    return (
      <div className={cn("flex flex-col gap-2", containerClassName)}>
        <label htmlFor={id} className="text-3 text-texto font-medium">
          {rotulo}
          {opcional ? (
            <span className="text-texto-2 font-normal"> (opcional)</span>
          ) : null}
        </label>
        {ajuda ? (
          <p id={idAjuda} className="text-corpo text-texto-2 -mt-1">
            {ajuda}
          </p>
        ) : null}
        <div
          className={cn(
            "rounded-2 bg-superficie min-h-toque-campo ease-estado flex items-center transition-[border-color,box-shadow] duration-140",
            classeCaixaPorEstado(erro ? "erro" : "normal", props.disabled),
          )}
        >
          <input
            ref={ref}
            id={id}
            name={nome}
            value={valor}
            onChange={(evento) => onMudar(evento.target.value)}
            aria-describedby={descrevePor}
            aria-invalid={erro ? true : undefined}
            className={cn(
              "rounded-2 text-corpo text-texto placeholder:text-texto-3 min-h-[calc(var(--spacing-toque-campo)-3px)] w-full min-w-0 border-0 bg-transparent px-4 focus-visible:shadow-none focus-visible:outline-none",
              className,
            )}
            {...props}
          />
        </div>
        {erro ? (
          <p
            id={idErro}
            className="text-corpo text-alerta flex items-start gap-2 font-medium"
          >
            <CircleAlert
              className="mt-1 size-4 shrink-0"
              aria-hidden="true"
              strokeWidth={1.75}
            />
            <span>{erro}</span>
          </p>
        ) : null}
      </div>
    );
  },
);
CampoFamilia.displayName = "CampoFamilia";
