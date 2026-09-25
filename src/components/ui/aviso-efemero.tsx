"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Aviso efêmero (DESIGN.md, seção 6; PRD 20.6 decisão 1). Faixa marinha que
 * sobe acima das abas inferiores, some sozinha depois de `duracaoSegundos`.
 * Usado pelo "Desfazer" do freio (10 s por padrão, mas o valor real vem de
 * `freio_desfazer_segundos`, configurado em `config_sistema`, nunca fixo
 * aqui) e por qualquer outra confirmação rápida com uma única ação reversível.
 */
export interface AvisoEfemeroProps {
  /** Controla se o aviso está visível. Fecha sozinho ao esgotar o tempo. */
  aberto: boolean;
  /** Chamado quando o aviso fecha, seja pelo tempo ou pela ação. */
  aoFechar: () => void;
  texto: React.ReactNode;
  /** Rótulo da ação reversível (ex: "Desfazer"). */
  rotuloAcao?: string;
  aoAcionarAcao?: () => void;
  /** Duração em segundos até fechar sozinho. Vem sempre de fora (config). */
  duracaoSegundos: number;
  className?: string;
}

export function AvisoEfemero({
  aberto,
  aoFechar,
  texto,
  rotuloAcao,
  aoAcionarAcao,
  duracaoSegundos,
  className,
}: AvisoEfemeroProps) {
  React.useEffect(() => {
    if (!aberto) return;
    const temporizador = window.setTimeout(() => {
      aoFechar();
    }, duracaoSegundos * 1000);
    return () => window.clearTimeout(temporizador);
  }, [aberto, duracaoSegundos, aoFechar]);

  if (!aberto) return null;

  return (
    <div
      role="status"
      className={cn(
        "rounded-pilula bg-marinho text-texto-inverso shadow-2 fixed inset-x-4 z-[var(--z-aviso)] flex items-center justify-between gap-3 px-4 py-3",
        className,
      )}
      style={{
        bottom: "calc(72px + env(safe-area-inset-bottom))",
      }}
    >
      <span className="text-apoio">{texto}</span>
      {rotuloAcao && aoAcionarAcao ? (
        <button
          type="button"
          onClick={() => {
            aoAcionarAcao();
            aoFechar();
          }}
          className="rounded-pilula min-h-toque text-apoio px-3 font-semibold underline underline-offset-2 hover:no-underline"
        >
          {rotuloAcao}
        </button>
      ) : null}
    </div>
  );
}
