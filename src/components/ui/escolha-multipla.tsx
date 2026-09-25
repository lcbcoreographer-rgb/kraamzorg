import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OpcaoEscolha } from "./escolha-unica";

export interface EscolhaMultiplaProps {
  /** Rótulo do grupo, sempre visível (ex: "O que foi feito hoje"). */
  rotulo: React.ReactNode;
  name: string;
  opcoes: OpcaoEscolha[];
  /** Valores marcados. Controlado. */
  valores?: string[];
  onMudar?: (valores: string[]) => void;
  descricao?: React.ReactNode;
  disabled?: boolean;
  className?: string;
}

/**
 * Marcação múltipla em pílulas (`.marcas`, DESIGN.md seção 6). Chips para "o
 * que foi feito hoje", cada um com caixa de marcação nativa por trás.
 */
export function EscolhaMultipla({
  rotulo,
  name,
  opcoes,
  valores = [],
  onMudar,
  descricao,
  disabled,
  className,
}: EscolhaMultiplaProps) {
  const idGrupo = React.useId();

  function alternar(valor: string) {
    if (!onMudar) return;
    const marcado = valores.includes(valor);
    onMudar(marcado ? valores.filter((item) => item !== valor) : [...valores, valor]);
  }

  return (
    <fieldset className={cn("flex flex-col gap-2 border-0 p-0", className)}>
      <legend id={idGrupo} className="text-apoio font-semibold text-texto">
        {rotulo}
      </legend>
      <div className="flex flex-wrap gap-2">
        {opcoes.map((opcao) => {
          const idOpcao = `${idGrupo}-${opcao.valor}`;
          const marcado = valores.includes(opcao.valor);
          return (
            <span key={opcao.valor} className="relative">
              <input
                type="checkbox"
                id={idOpcao}
                name={name}
                value={opcao.valor}
                checked={marcado}
                disabled={disabled}
                onChange={() => alternar(opcao.valor)}
                className="peer absolute size-px overflow-hidden opacity-0"
              />
              <label
                htmlFor={idOpcao}
                className={cn(
                  "flex min-h-toque cursor-pointer items-center gap-2 rounded-pilula border-[1.5px] border-borda-campo bg-superficie px-4 text-apoio font-medium text-texto select-none",
                  "hover:bg-marinho-08",
                  "peer-checked:border-acao peer-checked:bg-acao peer-checked:text-acao-texto",
                  "peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-foco peer-focus-visible:shadow-[0_0_0_5px_var(--foco-halo)]",
                  disabled && "cursor-not-allowed opacity-60",
                )}
              >
                {marcado ? <Check className="size-4" aria-hidden="true" /> : opcao.icone}
                {opcao.rotulo}
              </label>
            </span>
          );
        })}
      </div>
      {descricao ? <p className="text-apoio text-texto-2">{descricao}</p> : null}
    </fieldset>
  );
}
