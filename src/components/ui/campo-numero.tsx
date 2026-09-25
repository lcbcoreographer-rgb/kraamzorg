import * as React from "react";
import { cn } from "@/lib/utils";
import { AjudaCampo, classeCaixaPorEstado, RotuloCampo, type EstadoCampo } from "./campo";

export interface CampoNumeroProps {
  /** Texto do rótulo, sempre visível em cima do campo. */
  rotulo: React.ReactNode;
  /** Unidade mostrada à direita, em mono (°C, bpm, mmHg, g). */
  unidade?: React.ReactNode;
  /** Faixa aceita (DESIGN.md: "CampoNumero com unidade e faixa"). */
  min?: number;
  max?: number;
  step?: number;
  /** Texto de ajuda abaixo do campo (ex: valor do dia anterior). */
  descricao?: React.ReactNode;
  /** Mensagem de erro; também muda o estado para "erro". */
  erro?: React.ReactNode;
  estado?: EstadoCampo;
  opcional?: boolean;
  id?: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  autoFocus?: boolean;
  className?: string;
  containerClassName?: string;
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
}

export const CampoNumero = React.forwardRef<HTMLInputElement, CampoNumeroProps>(
  (
    {
      rotulo,
      unidade,
      min,
      max,
      step,
      descricao,
      erro,
      estado: estadoProp,
      opcional,
      id,
      className,
      containerClassName,
      ...props
    },
    ref,
  ) => {
    const idGerado = React.useId();
    const idCampo = id ?? idGerado;
    const idAjuda = `${idCampo}-ajuda`;
    const idErro = `${idCampo}-erro`;
    const estado: EstadoCampo = erro ? "erro" : (estadoProp ?? "normal");
    const descrevePor = [descricao ? idAjuda : null, erro ? idErro : null].filter(Boolean).join(" ") || undefined;

    return (
      <div className={cn("flex flex-col gap-2", containerClassName)}>
        <RotuloCampo htmlFor={idCampo} opcional={opcional}>
          {rotulo}
        </RotuloCampo>
        <div
          className={cn(
            "flex min-h-toque-campo items-center rounded-2 bg-superficie transition-[border-color,box-shadow] duration-140 ease-estado",
            classeCaixaPorEstado(estado, props.disabled),
          )}
        >
          <input
            ref={ref}
            id={idCampo}
            type="text"
            inputMode="decimal"
            aria-describedby={descrevePor}
            aria-invalid={estado === "erro" || undefined}
            aria-valuemin={min}
            aria-valuemax={max}
            className={cn(
              "min-h-[calc(var(--spacing-toque-campo)-3px)] w-full min-w-0 rounded-2 border-0 bg-transparent px-4 font-mono text-dado-lg font-medium tabular-nums text-texto placeholder:font-sans placeholder:text-base placeholder:font-normal placeholder:text-texto-3 focus-visible:outline-none",
              className,
            )}
            {...props}
          />
          {unidade ? (
            <span className="pr-4 pl-0 font-mono text-apoio text-texto-2">{unidade}</span>
          ) : null}
        </div>
        {erro ? (
          <AjudaCampo id={idErro} estado="erro" mensagem>
            {erro}
          </AjudaCampo>
        ) : descricao ? (
          <AjudaCampo id={idAjuda} estado={estado}>
            {descricao}
          </AjudaCampo>
        ) : null}
      </div>
    );
  },
);
CampoNumero.displayName = "CampoNumero";
