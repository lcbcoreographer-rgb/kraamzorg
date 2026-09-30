import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AjudaCampo,
  classeCaixaPorEstado,
  RotuloCampo,
  type EstadoCampo,
} from "./campo";

/**
 * Seleção de uma opção de uma lista longa (família, responsável), com o
 * `<select>` nativo por baixo: abre a roleta do celular e responde ao teclado.
 * Mesma caixa do CampoTexto (rótulo em cima, 44 px, erro e ajuda embaixo).
 * Para até cinco opções curtas, prefira EscolhaUnica.
 */
export interface OpcaoSelecao {
  valor: string;
  rotulo: string;
}

export interface CampoSelecaoProps {
  rotulo: React.ReactNode;
  name: string;
  opcoes: readonly OpcaoSelecao[];
  /** Primeira linha (valor vazio), por exemplo "Escolha uma família". */
  vazio?: string;
  defaultValue?: string;
  value?: string;
  onChange?: React.ChangeEventHandler<HTMLSelectElement>;
  descricao?: React.ReactNode;
  erro?: React.ReactNode;
  opcional?: boolean;
  disabled?: boolean;
  id?: string;
  containerClassName?: string;
}

export function CampoSelecao({
  rotulo,
  name,
  opcoes,
  vazio,
  defaultValue,
  value,
  onChange,
  descricao,
  erro,
  opcional,
  disabled,
  id,
  containerClassName,
}: CampoSelecaoProps) {
  const idGerado = React.useId();
  const idCampo = id ?? idGerado;
  const idAjuda = `${idCampo}-ajuda`;
  const idErro = `${idCampo}-erro`;
  const estado: EstadoCampo = erro ? "erro" : "normal";
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
          "rounded-2 bg-superficie ease-estado min-h-toque-campo relative flex items-center transition-[border-color,box-shadow] duration-140",
          classeCaixaPorEstado(estado, disabled),
        )}
      >
        <select
          id={idCampo}
          name={name}
          disabled={disabled}
          aria-describedby={descrevePor}
          aria-invalid={estado === "erro" || undefined}
          {...(value !== undefined ? { value } : { defaultValue })}
          onChange={onChange}
          className="rounded-2 text-corpo text-texto min-h-[calc(var(--spacing-toque-campo)-3px)] w-full min-w-0 appearance-none border-0 bg-transparent pr-10 pl-4 focus-visible:shadow-none focus-visible:outline-none"
        >
          {vazio !== undefined ? <option value="">{vazio}</option> : null}
          {opcoes.map((opcao) => (
            <option key={opcao.valor} value={opcao.valor}>
              {opcao.rotulo}
            </option>
          ))}
        </select>
        <ChevronDown
          className="text-texto-2 pointer-events-none absolute right-3 size-4"
          aria-hidden="true"
        />
      </div>
      {descricao ? (
        <AjudaCampo id={idAjuda} estado="normal">
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
}
