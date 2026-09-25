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
  // Contagem regressiva do "Desfazer": sem número, quem lê não sabe se
  // ainda dá tempo de tocar (crítica do CRM, P2 item 14).
  const [restante, definirRestante] = React.useState(duracaoSegundos);
  // Reinicia a contagem quando o aviso acaba de abrir. Ajustada durante a
  // renderização, com `useState` (não `useRef`, que este projeto não deixa
  // ler nem escrever durante a renderização) para guardar o `aberto`
  // anterior, como o guia do React recomenda para "ajustar estado quando
  // uma prop muda": evita o novo aviso herdar a contagem antiga.
  const [abertoAnterior, definirAbertoAnterior] = React.useState(aberto);
  if (aberto !== abertoAnterior) {
    definirAbertoAnterior(aberto);
    if (aberto) definirRestante(duracaoSegundos);
  }

  React.useEffect(() => {
    if (!aberto) return;
    const temporizador = window.setTimeout(() => {
      aoFechar();
    }, duracaoSegundos * 1000);
    const intervalo = window.setInterval(() => {
      definirRestante((r) => Math.max(0, r - 1));
    }, 1000);
    return () => {
      window.clearTimeout(temporizador);
      window.clearInterval(intervalo);
    };
  }, [aberto, duracaoSegundos, aoFechar]);

  // Com o texto em três linhas a pílula (raio total) fica com pontas
  // desproporcionais; `raio-3`, o mesmo dos cartões, encaixa melhor
  // (crítica do CRM, P2 item 14). Medido depois de montar: o texto é
  // dinâmico e a largura muda com a tela.
  const textoRef = React.useRef<HTMLSpanElement>(null);
  const [muitasLinhas, definirMuitasLinhas] = React.useState(false);

  React.useLayoutEffect(() => {
    if (!aberto) return;
    const el = textoRef.current;
    if (!el) return;
    const alturaLinha = parseFloat(getComputedStyle(el).lineHeight || "0");
    const linhas =
      alturaLinha > 0 ? Math.round(el.scrollHeight / alturaLinha) : 1;
    definirMuitasLinhas(linhas >= 3);
  }, [aberto, texto]);

  if (!aberto) return null;

  return (
    <div
      role="status"
      className={cn(
        "bg-marinho text-texto-inverso shadow-2 fixed inset-x-4 z-[var(--z-aviso)] flex items-center justify-between gap-3 px-4 py-3",
        muitasLinhas ? "rounded-3" : "rounded-pilula",
        className,
      )}
      style={{
        bottom: "calc(72px + env(safe-area-inset-bottom))",
      }}
    >
      <span ref={textoRef} className="text-apoio">
        {texto}
      </span>
      {rotuloAcao && aoAcionarAcao ? (
        <button
          type="button"
          onClick={() => {
            aoAcionarAcao();
            aoFechar();
          }}
          className="rounded-pilula min-h-toque text-apoio shrink-0 px-3 font-semibold underline underline-offset-2 hover:no-underline"
        >
          {rotuloAcao} {restante} s
        </button>
      ) : null}
    </div>
  );
}
