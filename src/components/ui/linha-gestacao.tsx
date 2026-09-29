import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Linha da família na gestação (DESIGN.md, 11.2 princípio 2 e 11.9;
 * proposta da direção, a mostrar na revisão). Herda a forma da régua de
 * dias (`regua-dias.tsx`): dez blocos de quatro semanas, cheios em marinho
 * até o bloco da semana atual, os seguintes tracejados ("ainda não"), e a
 * DPP em mono com "estimativa". Na ficha, o bloco atual ganha a borda
 * dourada da régua (`destacarAtual`); nas listas fica em marinho cheio,
 * para não repetir o acento da tela.
 *
 * A semana vem de `ig(dpp, data)`, calculada por quem chama; nada é
 * gravado. Quem chama também decide quando a linha some: depois do
 * nascimento (a régua D1 a Dn assume) e em estado sensível (DESIGN.md,
 * 11.8: a régua da gestação sai da tela de uma família em luto).
 */
export interface LinhaGestacaoProps {
  semanas: number;
  dias: number;
  /** "15/11/2026", já formatada. */
  dpp: string;
  /** Borda dourada no bloco atual (só na ficha, um acento por tela). */
  destacarAtual?: boolean;
  /** Esconde a legenda visível (a frase continua no `aria-label`). */
  semLegenda?: boolean;
  className?: string;
}

const BLOCOS = 10;
const SEMANAS_POR_BLOCO = 4;

export function LinhaGestacao({
  semanas,
  dias,
  dpp,
  destacarAtual,
  semLegenda,
  className,
}: LinhaGestacaoProps) {
  const semanasValidas = Math.max(0, Math.trunc(semanas));
  // Bloco 0 cobre as semanas 0 a 3, bloco 9 as semanas 36 a 40 (e além,
  // até a DPP passar: a linha fica cheia).
  const atual = Math.min(
    BLOCOS - 1,
    Math.floor(semanasValidas / SEMANAS_POR_BLOCO),
  );
  const frase = `${semanasValidas} semanas e ${Math.max(0, Math.trunc(dias))} ${
    Math.trunc(dias) === 1 ? "dia" : "dias"
  }, DPP estimada em ${dpp}`;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div
        role="img"
        aria-label={frase}
        className="grid grid-cols-10 gap-[3px]"
      >
        {Array.from({ length: BLOCOS }, (_, i) => (
          <span
            key={i}
            aria-hidden="true"
            className={cn(
              "rounded-pilula block min-h-[10px] border",
              i < atual && "bg-marinho border-marinho",
              i === atual &&
                (destacarAtual
                  ? "bg-marinho border-dourado shadow-anel-hoje border-2"
                  : "bg-marinho border-marinho"),
              i > atual &&
                "border-marinho-50 border-[1.5px] border-dashed bg-transparent",
            )}
          />
        ))}
      </div>
      {semLegenda ? null : (
        <p className="text-mini text-texto-2 flex flex-wrap items-baseline justify-between gap-x-3">
          <span className="font-mono tabular-nums">
            {semanasValidas}s{Math.max(0, Math.trunc(dias))}d
          </span>
          <span>
            DPP <span className="font-mono tabular-nums">{dpp}</span>{" "}
            <span className="italic">estimativa</span>
          </span>
        </p>
      )}
    </div>
  );
}
