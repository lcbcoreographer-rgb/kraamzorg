import * as React from "react";
import { CircleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Campo (DESIGN.md, seção 6). Rótulo em cima, sempre visível; placeholder só
 * como exemplo. Estados por `data-estado`: erro, aviso, alerta-clinico,
 * copiado, desabilitado. Usado por CampoTexto e CampoNumero.
 */
export type EstadoCampo =
  "normal" | "erro" | "aviso" | "alerta-clinico" | "copiado";

export function classeCaixaPorEstado(
  estado: EstadoCampo,
  desabilitado?: boolean,
): string {
  if (desabilitado) {
    return "border-linha bg-marinho-08";
  }
  switch (estado) {
    case "erro":
      return "border-2 border-alerta";
    case "aviso":
      return "border-2 border-aviso";
    case "alerta-clinico":
      return "border-2 border-alerta bg-alerta-lavado";
    case "copiado":
      return "border-2 border-dashed border-dourado bg-dourado-lavado";
    default:
      return "border-[1.5px] border-borda-campo hover:border-marinho-72 has-[:focus-visible]:border-foco has-[:focus-visible]:shadow-[0_0_0_4px_var(--foco-halo)]";
  }
}

export function classeAjudaPorEstado(estado: EstadoCampo): string {
  switch (estado) {
    case "erro":
      return "text-alerta font-medium";
    case "aviso":
      return "text-aviso-texto font-medium";
    case "alerta-clinico":
      return "text-alerta font-medium";
    default:
      return "text-texto-2";
  }
}

export function RotuloCampo({
  htmlFor,
  opcional,
  children,
}: {
  htmlFor: string;
  opcional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="text-apoio text-texto font-semibold">
      {children}
      {opcional ? (
        <span className="text-texto-2 font-normal"> (opcional)</span>
      ) : null}
    </label>
  );
}

export function AjudaCampo({
  id,
  estado,
  mensagem,
  children,
}: {
  id: string;
  estado: EstadoCampo;
  /** true quando é mensagem de erro (para `role="alert"`). */
  mensagem?: boolean;
  children: React.ReactNode;
}) {
  const ehErro = estado === "erro" || estado === "alerta-clinico";
  return (
    <p
      id={id}
      role={mensagem && ehErro ? "alert" : undefined}
      className={cn(
        "text-apoio flex items-start gap-2",
        classeAjudaPorEstado(estado),
      )}
    >
      {ehErro ? (
        <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      ) : null}
      <span>{children}</span>
    </p>
  );
}
