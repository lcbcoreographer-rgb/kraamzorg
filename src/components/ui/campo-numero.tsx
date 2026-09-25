import * as React from "react";
import { cn } from "@/lib/utils";
import {
  AjudaCampo,
  classeCaixaPorEstado,
  RotuloCampo,
  type EstadoCampo,
} from "./campo";

export interface FaixaCampoNumero {
  min?: number;
  max?: number;
}

export interface CampoNumeroProps {
  /** Texto do rótulo, sempre visível em cima do campo. */
  rotulo: React.ReactNode;
  /** Unidade mostrada à direita, em mono (°C, bpm, mmHg, g). */
  unidade?: React.ReactNode;
  /**
   * Faixa aceita, só para validar no `onBlur` (quem chama decide a mensagem
   * de erro). Não vira `min`/`max`/`step` do DOM: num `<input type="text">`
   * (exigido para aceitar vírgula decimal) esses atributos não fazem nada e
   * davam a impressão de uma faixa que não existia de verdade (achado da
   * auditoria da P10 parcial).
   */
  faixa?: FaixaCampoNumero;
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
  /**
   * Chamado no blur com o valor numérico (aceita vírgula decimal) e se ele
   * cai dentro de `faixa`. Quem chama decide o que fazer com isso (mostrar
   * `erro`, por exemplo); este componente só mede, não decide a mensagem.
   */
  aoValidarFaixa?: (valor: number | null, dentroDaFaixa: boolean) => void;
}

function paraNumero(valor: string): number | null {
  const normalizado = valor.trim().replace(",", ".");
  if (normalizado === "") return null;
  const numero = Number(normalizado);
  return Number.isFinite(numero) ? numero : null;
}

export const CampoNumero = React.forwardRef<HTMLInputElement, CampoNumeroProps>(
  (
    {
      rotulo,
      unidade,
      faixa,
      descricao,
      erro,
      estado: estadoProp,
      opcional,
      id,
      className,
      containerClassName,
      aoValidarFaixa,
      onBlur,
      ...props
    },
    ref,
  ) => {
    function lidarComBlur(evento: React.FocusEvent<HTMLInputElement>) {
      onBlur?.(evento);
      if (!aoValidarFaixa) return;
      const numero = paraNumero(evento.target.value);
      const dentroDaFaixa =
        numero !== null &&
        (faixa?.min === undefined || numero >= faixa.min) &&
        (faixa?.max === undefined || numero <= faixa.max);
      aoValidarFaixa(numero, dentroDaFaixa);
    }
    const idGerado = React.useId();
    const idCampo = id ?? idGerado;
    const idAjuda = `${idCampo}-ajuda`;
    const idErro = `${idCampo}-erro`;
    const idUnidade = `${idCampo}-unidade`;
    const estado: EstadoCampo = erro ? "erro" : (estadoProp ?? "normal");
    const descrevePor =
      [
        descricao ? idAjuda : null,
        erro ? idErro : null,
        unidade ? idUnidade : null,
      ]
        .filter(Boolean)
        .join(" ") || undefined;

    return (
      <div className={cn("flex flex-col gap-2", containerClassName)}>
        <RotuloCampo htmlFor={idCampo} opcional={opcional}>
          {rotulo}
        </RotuloCampo>
        <div
          className={cn(
            "min-h-toque-campo rounded-2 bg-superficie ease-estado flex items-center transition-[border-color,box-shadow] duration-140",
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
            data-min={faixa?.min}
            data-max={faixa?.max}
            onBlur={lidarComBlur}
            className={cn(
              "rounded-2 text-dado-lg text-texto placeholder:text-texto-3 placeholder:text-corpo min-h-[calc(var(--spacing-toque-campo)-3px)] w-full min-w-0 border-0 bg-transparent px-4 font-mono font-medium tabular-nums placeholder:font-sans placeholder:font-normal focus-visible:shadow-none focus-visible:outline-none",
              className,
            )}
            {...props}
          />
          {unidade ? (
            <span
              id={idUnidade}
              className="text-apoio text-texto-2 pr-4 pl-0 font-mono"
            >
              {unidade}
            </span>
          ) : null}
        </div>
        {/* Erro e descrição juntos, pelo mesmo motivo do CampoTexto. */}
        {descricao ? (
          <AjudaCampo id={idAjuda} estado={estado}>
            {descricao}
          </AjudaCampo>
        ) : null}
        {erro ? (
          <AjudaCampo id={idErro} estado="erro" mensagem>
            {erro}
          </AjudaCampo>
        ) : null}
      </div>
    );
  },
);
CampoNumero.displayName = "CampoNumero";
