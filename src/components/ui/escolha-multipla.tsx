"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEstadoControlavel } from "@/lib/hooks/estado-controlavel";
import type { OpcaoEscolha } from "./escolha-unica";

export interface EscolhaMultiplaProps {
  /** Rótulo do grupo, sempre visível (ex: "O que foi feito hoje"). */
  rotulo: React.ReactNode;
  name: string;
  opcoes: OpcaoEscolha[];
  /** Valores marcados. Controlado se passado. */
  valores?: string[];
  /** Valores iniciais quando não controlado. */
  valoresPadrao?: string[];
  onMudar?: (valores: string[]) => void;
  descricao?: React.ReactNode;
  disabled?: boolean;
  /** "checklist" sobe a pílula para 52 px (densidade do checklist da enfermeira, blocos 4, 5, 6 e 8). */
  tamanho?: "padrao" | "checklist";
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
  valores,
  valoresPadrao,
  onMudar,
  descricao,
  disabled,
  tamanho = "padrao",
  className,
}: EscolhaMultiplaProps) {
  const idGrupo = React.useId();
  const [valoresAtuaisOuIndefinido, definirValoresAtuais] =
    useEstadoControlavel<string[]>(valores, valoresPadrao ?? [], onMudar);
  const valoresAtuais = valoresAtuaisOuIndefinido ?? [];

  function alternar(valor: string) {
    const marcado = valoresAtuais.includes(valor);
    definirValoresAtuais(
      marcado
        ? valoresAtuais.filter((item) => item !== valor)
        : [...valoresAtuais, valor],
    );
  }

  return (
    <fieldset className={cn("flex flex-col gap-2 border-0 p-0", className)}>
      <legend id={idGrupo} className="text-apoio text-texto font-semibold">
        {rotulo}
      </legend>
      <div className="flex flex-wrap gap-2">
        {opcoes.map((opcao) => {
          const idOpcao = `${idGrupo}-${opcao.valor}`;
          const marcado = valoresAtuais.includes(opcao.valor);
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
                  "rounded-pilula border-borda-campo bg-superficie text-apoio text-texto flex cursor-pointer items-center gap-2 border-[1.5px] px-4 font-medium select-none",
                  tamanho === "checklist" ? "min-h-toque-campo" : "min-h-toque",
                  "hover:bg-marinho-08",
                  "peer-checked:border-acao peer-checked:bg-acao peer-checked:text-acao-texto",
                  "peer-focus-visible:outline-foco peer-focus-visible:shadow-[0_0_0_5px_var(--foco-halo)] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2",
                  disabled &&
                    "bg-marinho-08 text-marinho-62 cursor-not-allowed",
                )}
              >
                {marcado ? (
                  <Check className="size-4" aria-hidden="true" />
                ) : (
                  opcao.icone
                )}
                {opcao.rotulo}
              </label>
            </span>
          );
        })}
      </div>
      {descricao ? (
        <p className="text-apoio text-texto-2">{descricao}</p>
      ) : null}
    </fieldset>
  );
}
