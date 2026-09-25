import * as React from "react";
import { cn } from "@/lib/utils";

export interface OpcaoEscolha {
  valor: string;
  rotulo: React.ReactNode;
  icone?: React.ReactNode;
}

export interface EscolhaUnicaProps {
  /** Rótulo do grupo (pergunta ou nome do campo), sempre visível. */
  rotulo: React.ReactNode;
  name: string;
  opcoes: OpcaoEscolha[];
  valor?: string;
  onMudar?: (valor: string) => void;
  descricao?: React.ReactNode;
  disabled?: boolean;
  className?: string;
}

/**
 * Escolha única em pílulas (repertório de `.marcas`/`.escala` do
 * DESIGN.md, adaptado para uma resposta só). Radiogroup nativo por trás,
 * pílula tocável de 44 px no mínimo.
 */
export function EscolhaUnica({
  rotulo,
  name,
  opcoes,
  valor,
  onMudar,
  descricao,
  disabled,
  className,
}: EscolhaUnicaProps) {
  const idGrupo = React.useId();

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <span id={idGrupo} className="text-apoio text-texto font-semibold">
        {rotulo}
      </span>
      <div
        role="radiogroup"
        aria-labelledby={idGrupo}
        className="flex flex-wrap gap-2"
      >
        {opcoes.map((opcao) => {
          const idOpcao = `${idGrupo}-${opcao.valor}`;
          const marcado = valor === opcao.valor;
          return (
            <span key={opcao.valor} className="relative">
              <input
                type="radio"
                id={idOpcao}
                name={name}
                value={opcao.valor}
                checked={marcado}
                disabled={disabled}
                onChange={() => onMudar?.(opcao.valor)}
                className="peer absolute size-px overflow-hidden opacity-0"
              />
              <label
                htmlFor={idOpcao}
                className={cn(
                  "min-h-toque rounded-pilula border-borda-campo bg-superficie text-apoio text-texto flex cursor-pointer items-center gap-2 border-[1.5px] px-4 font-medium select-none",
                  "hover:bg-marinho-08",
                  "peer-checked:border-acao peer-checked:bg-acao peer-checked:text-acao-texto",
                  "peer-focus-visible:outline-foco peer-focus-visible:shadow-[0_0_0_5px_var(--foco-halo)] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2",
                  disabled && "cursor-not-allowed opacity-60",
                )}
              >
                {opcao.icone}
                {opcao.rotulo}
              </label>
            </span>
          );
        })}
      </div>
      {descricao ? (
        <p className="text-apoio text-texto-2">{descricao}</p>
      ) : null}
    </div>
  );
}
