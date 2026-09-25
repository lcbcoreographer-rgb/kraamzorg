"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Painel lateral: contexto sem sair da lista (detalhe de uma linha da
 * TabelaLista, filtro, conteúdo auxiliar). Mesma base de acessibilidade do
 * Dialogo (Radix Dialog: foco preso, Esc fecha, rótulo obrigatório), com
 * outra composição visual: desliza da direita, ocupa a tela toda no
 * celular e uma faixa fixa a partir do computador.
 */
export const PainelLateral = DialogPrimitive.Root;
export const PainelLateralGatilho = DialogPrimitive.Trigger;
export const PainelLateralFechar = DialogPrimitive.Close;

export function PainelLateralConteudo({
  className,
  children,
  titulo,
  tituloOculto,
  descricao,
  rotuloFechar,
  "aria-describedby": ariaDescribedby,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
  titulo: React.ReactNode;
  tituloOculto?: boolean;
  descricao?: React.ReactNode;
  rotuloFechar: string;
}) {
  const idDescricao = React.useId();

  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="bg-marinho/40 data-[state=open]:animate-in data-[state=open]:fade-in data-[state=closed]:animate-out data-[state=closed]:fade-out fixed inset-0 z-40" />
      <DialogPrimitive.Content
        className={cn(
          "bg-superficie shadow-2 fixed inset-y-0 right-0 z-40 flex w-full max-w-[420px] flex-col gap-4 overflow-y-auto p-4 sm:p-6",
          "data-[state=open]:animate-in data-[state=open]:slide-in-from-right data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right",
          className,
        )}
        // Mesmo motivo do Dialogo: sem descrição, nada de <Description>
        // vazia só pra silenciar o aviso do Radix.
        aria-describedby={descricao ? idDescricao : ariaDescribedby}
        {...props}
      >
        <div className="flex items-start justify-between gap-3">
          <DialogPrimitive.Title
            className={cn(
              "font-titulo text-2 text-texto font-medium",
              tituloOculto && "sr-only",
            )}
          >
            {titulo}
          </DialogPrimitive.Title>
          <DialogPrimitive.Close
            aria-label={rotuloFechar}
            className="size-toque rounded-pilula text-texto-2 hover:bg-marinho-08 -mt-1 -mr-1 flex shrink-0 items-center justify-center"
          >
            <X className="size-5" aria-hidden="true" />
          </DialogPrimitive.Close>
        </div>
        {descricao ? (
          <p id={idDescricao} className="text-apoio text-texto-2">
            {descricao}
          </p>
        ) : null}
        <div className="flex-1">{children}</div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
