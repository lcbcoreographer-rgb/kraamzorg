"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Folha inferior / diálogo (`folha`, DESIGN.md seção 6). Para confirmação
 * que protege algo irreversível (assinar, reverter freio, recusar oferta
 * com motivo). Sobe do rodapé no celular; no computador vira diálogo
 * centralizado de 520 px. Nunca para tarefa comum.
 */
export const Dialogo = DialogPrimitive.Root;
export const DialogoGatilho = DialogPrimitive.Trigger;
export const DialogoFechar = DialogPrimitive.Close;

export function DialogoConteudo({
  className,
  children,
  titulo,
  tituloOculto,
  descricao,
  rotuloFechar,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
  /** Título obrigatório para acessibilidade (o Radix exige um). */
  titulo: React.ReactNode;
  /** Esconde o título visualmente (ainda lido por leitor de tela). */
  tituloOculto?: boolean;
  descricao?: React.ReactNode;
  /** Rótulo acessível do botão de fechar (aria-label). */
  rotuloFechar: string;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="bg-marinho/40 data-[state=open]:animate-in data-[state=open]:fade-in data-[state=closed]:animate-out data-[state=closed]:fade-out fixed inset-0 z-40" />
      <DialogPrimitive.Content
        className={cn(
          "rounded-t-3 bg-superficie shadow-2 fixed inset-x-0 bottom-0 z-40 max-h-[88dvh] overflow-y-auto p-4 pb-8",
          "data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom",
          "lg:rounded-3 lg:top-1/2 lg:right-auto lg:bottom-auto lg:left-1/2 lg:max-h-none lg:w-[520px] lg:-translate-x-1/2 lg:-translate-y-1/2",
          "lg:data-[state=open]:zoom-in-95 lg:data-[state=closed]:zoom-out-95 lg:data-[state=open]:slide-in-from-bottom-0",
          className,
        )}
        {...props}
      >
        <span
          aria-hidden="true"
          className="rounded-pilula bg-marinho-50 mx-auto mb-4 block h-1 w-10 lg:hidden"
        />
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
          <DialogPrimitive.Description className="text-apoio text-texto-2 mt-2">
            {descricao}
          </DialogPrimitive.Description>
        ) : (
          <DialogPrimitive.Description className="sr-only" />
        )}
        <div className="mt-4">{children}</div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogoRodape({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className,
      )}
      {...props}
    />
  );
}
