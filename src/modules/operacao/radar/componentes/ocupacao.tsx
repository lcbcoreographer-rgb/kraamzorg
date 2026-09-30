import { Selo } from "@/components/ui/selo";
import type { OcupacaoSemana } from "@/lib/dados/tipos-operacao";
import { formatarData } from "@/lib/formatacao";
import { cn } from "@/lib/utils";
import { ocupacaoPorPraca } from "../agrupar";

const PORCENTAGEM = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 1,
});

/** Dez blocos de 10% cada, preenchidos até a ocupação da semana. */
const BLOCOS = Array.from({ length: 10 }, (_, i) => i);

/**
 * Régua da ocupação (forma-assinatura da casa para capacidade, DESIGN.md
 * 11.10): dez blocos de 10% cada, preenchidos em marinho até o número da
 * semana, e o limite de alerta como um traço vertical. É `aria-hidden`: a
 * frase ao lado diz a porcentagem e a situação.
 */
function ReguaOcupacao({
  pct,
  limitePct,
}: {
  pct: number;
  limitePct: number | null;
}) {
  return (
    <span aria-hidden="true" className="relative flex w-full gap-1 py-1">
      {BLOCOS.map((i) => {
        const fracao = Math.min(Math.max((pct - i * 10) / 10, 0), 1);
        return (
          <span
            key={i}
            className="rounded-1 bg-lavanda-media relative h-3 flex-1 overflow-hidden"
          >
            {fracao > 0 ? (
              <span
                className="bg-marinho absolute inset-y-0 left-0"
                style={{ width: `${fracao * 100}%` }}
              />
            ) : null}
          </span>
        );
      })}
      {limitePct !== null && limitePct > 0 && limitePct < 100 ? (
        <span
          className="bg-marinho absolute inset-y-0 w-0.5"
          style={{ left: `calc(${limitePct}% - 1px)` }}
        />
      ) : null}
    </span>
  );
}

/**
 * Ocupação projetada por praça e semana (P36 item 2, fluxo C; direção
 * "Colo"). O número vem da view `ocupacao_projetada`; cada praça é um bloco
 * lavanda (tempo), cada semana uma linha com a régua de dez blocos, a
 * porcentagem e as famílias. Só a semana acima do limite do parâmetro
 * `capacidade_alerta_pct` ganha selo (aviso, com texto): o que está dentro
 * do esperado fica neutro (DESIGN.md 11.10).
 */
export function OcupacaoPorPraca({
  ocupacao,
  limitePct,
}: {
  ocupacao: OcupacaoSemana[];
  limitePct: number | null;
}) {
  const pracas = ocupacaoPorPraca(ocupacao);
  if (pracas.length === 0) return null;
  return (
    <div className="flex flex-col gap-4">
      {limitePct !== null ? (
        <p className="text-apoio text-texto-2">
          Cada bloco é 10% da capacidade da praça. O traço marca o limite de
          alerta, {PORCENTAGEM.format(limitePct)}%.
        </p>
      ) : null}
      <div
        className={cn(
          "grid grid-cols-1 gap-4",
          pracas.length > 1 ? "lg:grid-cols-2" : "lg:max-w-[760px]",
        )}
      >
        {pracas.map((p) => (
          <section
            key={p.regiaoId}
            aria-labelledby={`ocupacao-${p.regiaoId}`}
            className="rounded-3 bg-lavanda-clara flex flex-col gap-3 p-5"
          >
            <h3
              id={`ocupacao-${p.regiaoId}`}
              className="font-titulo text-2 text-texto font-medium"
            >
              {p.regiao}
            </h3>
            <ul className="flex flex-col gap-1">
              {p.semanas.map((s) => {
                const pct = PORCENTAGEM.format(s.ocupacaoPct);
                return (
                  <li
                    key={`${s.regiaoId}-${s.semana}`}
                    className={cn(
                      "rounded-2 grid grid-cols-[5.5rem_minmax(0,1fr)_3.5rem] items-center gap-x-3 px-3 py-2",
                      s.acimaDoLimite ? "bg-superficie" : null,
                    )}
                  >
                    <span className="flex flex-col">
                      <span className="text-mini text-texto-2">Semana de</span>
                      <span className="text-dado text-texto font-mono">
                        {formatarData(s.semana)?.slice(0, 5) ?? s.semana}
                      </span>
                    </span>
                    <span className="flex flex-col gap-0.5">
                      <ReguaOcupacao
                        pct={s.ocupacaoPct}
                        limitePct={limitePct}
                      />
                      <span className="text-mini text-texto-2">
                        {s.familias === 1
                          ? "1 família"
                          : `${s.familias} famílias`}
                        <span className="sr-only">
                          {`, semana de ${formatarData(s.semana) ?? s.semana}, ocupação de ${pct}%`}
                        </span>
                      </span>
                    </span>
                    <span
                      aria-hidden="true"
                      className="text-dado text-texto text-right font-mono font-medium tabular-nums"
                    >
                      {pct}%
                    </span>
                    {s.acimaDoLimite ? (
                      <Selo
                        variante="aviso"
                        className="col-span-3 mt-1 justify-self-start"
                      >
                        {limitePct !== null
                          ? `Acima de ${PORCENTAGEM.format(limitePct)}%`
                          : "Acima do limite"}
                      </Selo>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
