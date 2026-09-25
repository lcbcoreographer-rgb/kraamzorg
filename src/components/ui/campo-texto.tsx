import * as React from "react";
import { cn } from "@/lib/utils";
import {
  AjudaCampo,
  classeCaixaPorEstado,
  RotuloCampo,
  type EstadoCampo,
} from "./campo";

type CamposComuns =
  | "className"
  | "id"
  | "value"
  | "defaultValue"
  | "onChange"
  | "onBlur"
  | "placeholder"
  | "disabled"
  | "required"
  | "name"
  | "readOnly"
  | "maxLength"
  | "autoFocus"
  | "autoComplete";

export interface CampoTextoProps extends Pick<
  React.InputHTMLAttributes<HTMLInputElement>,
  CamposComuns
> {
  /** Texto do rótulo, sempre visível em cima do campo. */
  rotulo: React.ReactNode;
  /** Texto de ajuda abaixo do campo (referência do dia anterior, dica). */
  descricao?: React.ReactNode;
  /** Mensagem de erro; também muda o estado para "erro". */
  erro?: React.ReactNode;
  /** Estado explícito quando não é erro (aviso, alerta-clinico, copiado). */
  estado?: EstadoCampo;
  /** Mostra "(opcional)" ao lado do rótulo. */
  opcional?: boolean;
  /** Renderiza `<textarea>` em vez de `<input>` (texto longo). */
  multilinha?: boolean;
  /** Linhas visíveis do `<textarea>` (só com `multilinha`). */
  linhas?: number;
  containerClassName?: string;
  type?: React.HTMLInputTypeAttribute;
}

export const CampoTexto = React.forwardRef<
  HTMLInputElement | HTMLTextAreaElement,
  CampoTextoProps
>(
  (
    {
      rotulo,
      descricao,
      erro,
      estado: estadoProp,
      opcional,
      multilinha,
      linhas = 4,
      id,
      className,
      containerClassName,
      type = "text",
      ...props
    },
    ref,
  ) => {
    const idGerado = React.useId();
    const idCampo = id ?? idGerado;
    const idAjuda = `${idCampo}-ajuda`;
    const idErro = `${idCampo}-erro`;
    const estado: EstadoCampo = erro ? "erro" : (estadoProp ?? "normal");
    const descrevePor =
      [descricao ? idAjuda : null, erro ? idErro : null]
        .filter(Boolean)
        .join(" ") || undefined;

    return (
      <div className={cn("flex flex-col gap-2", containerClassName)}>
        <RotuloCampo htmlFor={idCampo} opcional={opcional}>
          {rotulo}
        </RotuloCampo>
        <div
          className={cn(
            "rounded-2 bg-superficie ease-estado flex items-center transition-[border-color,box-shadow] duration-140",
            multilinha ? "items-stretch" : "min-h-toque-campo",
            classeCaixaPorEstado(estado, props.disabled),
          )}
        >
          {multilinha ? (
            <textarea
              ref={ref as React.Ref<HTMLTextAreaElement>}
              id={idCampo}
              rows={linhas}
              aria-describedby={descrevePor}
              aria-invalid={estado === "erro" || undefined}
              className={cn(
                "rounded-2 text-corpo text-texto placeholder:text-texto-3 min-h-[120px] w-full min-w-0 resize-y border-0 bg-transparent px-4 py-3 leading-normal focus-visible:outline-none",
                className,
              )}
              {...(props as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
            />
          ) : (
            <input
              ref={ref as React.Ref<HTMLInputElement>}
              id={idCampo}
              type={type}
              aria-describedby={descrevePor}
              aria-invalid={estado === "erro" || undefined}
              className={cn(
                "rounded-2 text-corpo text-texto placeholder:text-texto-3 min-h-[calc(var(--spacing-toque-campo)-3px)] w-full min-w-0 border-0 bg-transparent px-4 focus-visible:outline-none",
                className,
              )}
              {...props}
            />
          )}
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
CampoTexto.displayName = "CampoTexto";
