"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useEstadoControlavel } from "@/lib/hooks/estado-controlavel";

/**
 * Escala 0 a 10 (DESIGN.md, seção 6). Onze alvos de 52 px: duas linhas de
 * seis no celular, uma linha a partir de 600 px (`tablet:`, não o `sm:`
 * padrão do Tailwind, que é 640 px). Números em mono, extremos descritos
 * por texto ("0 · sem dor"), ligados ao `radiogroup` por
 * `aria-describedby` (sem isto, o leitor de tela só ouvia "0, botão de
 * opção", sem o que "0" significa). Sem gradiente verde para vermelho: a
 * escala não sugere resposta; o corte de alerta aparece depois, numa
 * FaixaAlerta separada.
 */
export interface Escala0a10Props {
  /** Pergunta ou nome da escala ("Dor agora"), rótulo acessível do grupo. */
  rotulo: React.ReactNode;
  name: string;
  /** Controlado se passado. */
  valor?: number;
  /** Valor inicial quando não controlado. */
  valorPadrao?: number;
  onMudar?: (valor: number) => void;
  /** Texto do extremo 0 (ex: "0 · sem dor"). */
  extremoMin?: React.ReactNode;
  /** Texto do extremo 10 (ex: "10 · pior dor possível"). */
  extremoMax?: React.ReactNode;
  disabled?: boolean;
  className?: string;
}

const OPCOES = Array.from({ length: 11 }, (_, indice) => indice);

export function Escala0a10({
  rotulo,
  name,
  valor,
  valorPadrao,
  onMudar,
  extremoMin,
  extremoMax,
  disabled,
  className,
}: Escala0a10Props) {
  const idGrupo = React.useId();
  const idExtremoMin = `${idGrupo}-min`;
  const idExtremoMax = `${idGrupo}-max`;
  const [valorAtual, definirValorAtual] = useEstadoControlavel(
    valor,
    valorPadrao,
    onMudar,
  );

  const descrevePor =
    [extremoMin ? idExtremoMin : null, extremoMax ? idExtremoMax : null]
      .filter(Boolean)
      .join(" ") || undefined;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <span id={idGrupo} className="text-apoio text-texto font-semibold">
        {rotulo}
      </span>
      <div
        role="radiogroup"
        aria-labelledby={idGrupo}
        aria-describedby={descrevePor}
        className="tablet:grid-cols-11 grid grid-cols-6 gap-2"
      >
        {OPCOES.map((numero) => {
          const idOpcao = `${idGrupo}-${numero}`;
          const marcado = valorAtual === numero;
          return (
            <span key={numero} className="relative">
              <input
                type="radio"
                id={idOpcao}
                name={name}
                value={numero}
                checked={marcado}
                disabled={disabled}
                onChange={() => definirValorAtual(numero)}
                className="peer absolute size-px overflow-hidden opacity-0"
              />
              <label
                htmlFor={idOpcao}
                className={cn(
                  "min-h-toque-campo rounded-2 border-borda-campo bg-superficie text-texto text-3 flex cursor-pointer items-center justify-center border-[1.5px] font-mono font-medium select-none",
                  "hover:bg-marinho-08",
                  "peer-checked:border-acao peer-checked:bg-acao peer-checked:text-acao-texto",
                  "peer-focus-visible:outline-foco peer-focus-visible:shadow-[0_0_0_5px_var(--foco-halo)] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2",
                  disabled &&
                    "bg-marinho-08 text-marinho-62 cursor-not-allowed",
                )}
              >
                {numero}
              </label>
            </span>
          );
        })}
      </div>
      {extremoMin || extremoMax ? (
        <div className="text-mini text-texto-2 flex justify-between">
          <span id={idExtremoMin}>{extremoMin}</span>
          <span id={idExtremoMax}>{extremoMax}</span>
        </div>
      ) : null}
    </div>
  );
}
