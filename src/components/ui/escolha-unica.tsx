"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useEstadoControlavel } from "@/lib/hooks/estado-controlavel";

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
  /** Controlado se passado. */
  valor?: string;
  /** Valor inicial quando não controlado. */
  valorPadrao?: string;
  onMudar?: (valor: string) => void;
  descricao?: React.ReactNode;
  disabled?: boolean;
  /** "checklist" sobe a pílula para 52 px (densidade do checklist da enfermeira). */
  tamanho?: "padrao" | "checklist";
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
  valorPadrao,
  onMudar,
  descricao,
  disabled,
  tamanho = "padrao",
  className,
}: EscolhaUnicaProps) {
  const idGrupo = React.useId();
  const [valorAtual, definirValorAtual] = useEstadoControlavel(
    valor,
    valorPadrao,
    onMudar,
  );

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
          const marcado = valorAtual === opcao.valor;
          return (
            <span key={opcao.valor} className="relative">
              <input
                type="radio"
                id={idOpcao}
                name={name}
                value={opcao.valor}
                checked={marcado}
                disabled={disabled}
                onChange={() => definirValorAtual(opcao.valor)}
                className="peer absolute size-px overflow-hidden opacity-0"
              />
              <label
                htmlFor={idOpcao}
                className={cn(
                  "rounded-pilula border-borda-campo bg-superficie text-apoio text-texto flex cursor-pointer items-center gap-2 border-[1.5px] px-4 font-medium select-none",
                  tamanho === "checklist" ? "min-h-toque-campo" : "min-h-toque",
                  "hover:bg-marinho-08",
                  "peer-checked:border-acao peer-checked:bg-acao peer-checked:text-acao-texto",
                  "peer-focus-visible:outline-foco peer-focus-visible:shadow-[0_0_0_5px_var(--foco-halo)] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2",
                  disabled &&
                    "bg-marinho-08 text-marinho-62 cursor-not-allowed",
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
