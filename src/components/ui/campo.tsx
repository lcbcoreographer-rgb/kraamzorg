import * as React from "react";
import { CircleAlert, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Campo (DESIGN.md, seção 6). Rótulo em cima, sempre visível; placeholder só
 * como exemplo. Estados por `data-estado`: erro, aviso, alerta-clinico,
 * copiado, desabilitado. Usado por CampoTexto e CampoNumero.
 */
export type EstadoCampo =
  "normal" | "erro" | "aviso" | "alerta-clinico" | "copiado";

/**
 * Foco consistente nos cinco estados: antes, só o normal tinha regra de
 * foco própria; nos outros, sobrava o halo global do `<input>` (dourado a
 * 55%) por cima da borda de estado, o que deixava o erro com cara de
 * "marrom" quando focado (achado da auditoria da P10 parcial). Agora todo
 * estado ganha `has-[:focus-visible]:outline` na caixa, sem mudar a cor da
 * borda de estado; o halo do `<input>` é desligado em `campo-texto.tsx` e
 * `campo-numero.tsx` (`focus-visible:shadow-none`) para não dobrar.
 */
const FOCO_CAIXA =
  "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-foco has-[:focus-visible]:outline-offset-2";

export function classeCaixaPorEstado(
  estado: EstadoCampo,
  desabilitado?: boolean,
): string {
  if (desabilitado) {
    return "border-linha bg-marinho-08";
  }
  switch (estado) {
    case "erro":
      return cn("border-2 border-alerta", FOCO_CAIXA);
    case "aviso":
      return cn("border-2 border-aviso", FOCO_CAIXA);
    case "alerta-clinico":
      return cn("border-2 border-alerta bg-alerta-lavado", FOCO_CAIXA);
    case "copiado":
      return cn(
        "border-2 border-dashed border-dourado bg-dourado-lavado",
        FOCO_CAIXA,
      );
    default:
      return cn(
        "border-[1.5px] border-borda-campo hover:border-marinho-72",
        FOCO_CAIXA,
      );
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
  const ehAviso = estado === "aviso";
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
      ) : ehAviso ? (
        <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      ) : null}
      <span>{children}</span>
    </p>
  );
}
