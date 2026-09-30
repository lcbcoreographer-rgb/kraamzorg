"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEstadoControlavel } from "@/lib/hooks/estado-controlavel";

/**
 * Pergunta com seletor sim ou não em um toque (DESIGN.md, seção 6). Pergunta
 * à esquerda, duas pílulas de 52 px à direita. Nenhuma das opções tem cor de
 * "certo" ou "errado"; só a resposta que dispara regra pinta a pergunta de
 * alerta (o consumidor decide isso e passa `estado="alerta-clinico"`; a
 * faixa que explica a conduta é um `FaixaAlerta` renderizado logo abaixo).
 * Sem valor padrão: nenhuma pílula vem marcada até a pessoa responder.
 */
export interface SimNaoProps {
  /** Pergunta, em frase completa ("Febre nas últimas 24 horas?"). */
  pergunta: React.ReactNode;
  /** Nome do grupo de rádio (agrupa as duas pílulas). */
  name: string;
  /** "sim" | "nao" | undefined (sem resposta ainda). Controlado se passado. */
  valor?: "sim" | "nao";
  /** Valor inicial quando não controlado (sem `valor`). */
  valorPadrao?: "sim" | "nao";
  onMudar?: (valor: "sim" | "nao") => void;
  /** Texto da pílula "sim" (ex: "Sim"). Sem padrão fixo: vem sempre da tela. */
  rotuloSim: string;
  /** Texto da pílula "não" (ex: "Não"). */
  rotuloNao: string;
  /** Pinta a pergunta de alerta quando a resposta disparou uma regra. */
  estado?: "normal" | "alerta-clinico";
  disabled?: boolean;
  /**
   * "linha" (padrão): pergunta à esquerda e pílulas de 52 px à direita,
   * com a divisória embaixo. "cartao" [v4.4]: dentro do cartão da
   * pergunta (checklist), a pergunta em cima e as duas respostas em
   * pílulas redondas de 56 px dividindo a largura, sem divisória.
   */
  arranjo?: "linha" | "cartao";
  className?: string;
}

export function SimNao({
  pergunta,
  name,
  valor,
  valorPadrao,
  onMudar,
  rotuloSim,
  rotuloNao,
  estado = "normal",
  disabled,
  arranjo = "linha",
  className,
}: SimNaoProps) {
  const cartao = arranjo === "cartao";
  const idPergunta = React.useId();
  const [valorAtual, definirValorAtual] = useEstadoControlavel(
    valor,
    valorPadrao,
    onMudar,
  );

  function opcao(rotulo: string, valorOpcao: "sim" | "nao") {
    const marcado = valorAtual === valorOpcao;
    const idOpcao = `${idPergunta}-${valorOpcao}`;
    return (
      <span className={cn("relative", cartao && "flex")}>
        <input
          type="radio"
          id={idOpcao}
          name={name}
          value={valorOpcao}
          checked={marcado}
          disabled={disabled}
          onChange={() => definirValorAtual(valorOpcao)}
          className="peer absolute size-px overflow-hidden opacity-0"
        />
        <label
          htmlFor={idOpcao}
          className={cn(
            "rounded-pilula border-borda-campo bg-superficie text-texto ease-estado flex min-w-[76px] cursor-pointer items-center justify-center gap-1.5 border-[1.5px] px-4 font-semibold transition-[background-color,color,transform] duration-140 select-none",
            cartao
              ? "min-h-toque-grande text-corpo w-full flex-1"
              : "min-h-toque-campo",
            "hover:bg-marinho-08 active:scale-[0.96]",
            "peer-checked:border-acao peer-checked:bg-acao peer-checked:text-acao-texto peer-checked:hover:bg-acao-hover",
            "peer-focus-visible:outline-foco peer-focus-visible:shadow-[0_0_0_5px_var(--foco-halo)] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2",
            disabled && "cursor-not-allowed opacity-60",
          )}
        >
          {marcado ? (
            <Check className="size-[18px]" aria-hidden="true" />
          ) : null}
          {rotulo}
        </label>
      </span>
    );
  }

  return (
    <div
      className={cn(
        cartao
          ? "flex flex-col gap-3"
          : "border-linha grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3 border-b py-3",
        className,
      )}
    >
      <span
        id={idPergunta}
        data-estado={estado}
        className={cn(
          "leading-snug font-medium",
          cartao ? "text-3" : "text-corpo",
          estado === "alerta-clinico" ? "text-alerta" : "text-texto",
        )}
      >
        {pergunta}
      </span>
      <div
        role="radiogroup"
        aria-labelledby={idPergunta}
        className={cn(
          "grid-cols-2 gap-2",
          cartao ? "grid w-full" : "inline-grid",
        )}
      >
        {opcao(rotuloSim, "sim")}
        {opcao(rotuloNao, "nao")}
      </div>
    </div>
  );
}
