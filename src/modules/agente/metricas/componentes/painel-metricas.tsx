import { CircleCheck, TriangleAlert } from "lucide-react";
import { formatarData } from "@/lib/formatacao";
import { cn } from "@/lib/utils";
import type { MetricasAgente } from "../../tipos";
import { linhasMetricas, type EstadoMeta } from "../linhas";

const ESTADO: Record<
  EstadoMeta,
  { rotulo: string; classe: string; Icone?: typeof CircleCheck } | null
> = {
  na_meta: { rotulo: "na meta", classe: "text-sucesso", Icone: CircleCheck },
  abaixo: {
    rotulo: "abaixo da meta",
    classe: "text-aviso-texto",
    Icone: TriangleAlert,
  },
  sem_dado: { rotulo: "sem dado", classe: "text-texto-2" },
  sem_regra: null,
};

/**
 * Números do mês da Isadora (P27 item 5, PRD 11.12), no formato "painel que
 * fala" (DESIGN.md, 11.10): uma linha por métrica, a frase com o número em
 * mono, a meta ao lado e a palavra de estado com ícone quando a meta é
 * mensurável. Tabela que vira lista (DESIGN.md, seção 6), com divisória
 * fina, nenhuma grade de cartões de KPI. Cor só onde a meta diz que o
 * número saiu do esperado, e sempre com a palavra ao lado.
 */
export function PainelMetricas({
  metricas,
  limiarAmostra = null,
}: {
  metricas: MetricasAgente;
  /** `parametro` do limiar de amostra pequena; null quando não existe. */
  limiarAmostra?: number | null;
}) {
  const linhas = linhasMetricas(metricas, limiarAmostra);
  return (
    <div className="flex flex-col gap-3">
      <p className="text-apoio text-texto-2">
        De{" "}
        <span className="font-mono tabular-nums">
          {formatarData(metricas.periodoDesde)}
        </span>{" "}
        a{" "}
        <span className="font-mono tabular-nums">
          {formatarData(metricas.periodoAte)}
        </span>
        , com{" "}
        <span className="font-mono tabular-nums">{metricas.leadsTotal}</span>{" "}
        {metricas.leadsTotal === 1 ? "lead" : "leads"} no período.
      </p>
      <ul
        aria-label="Números do mês da Isadora"
        className="bg-superficie rounded-3 shadow-1 divide-linha flex flex-col divide-y px-4 lg:px-5"
      >
        {linhas.map((linha) => {
          const estado = ESTADO[linha.estado];
          return (
            <li
              key={linha.chave}
              className="grid grid-cols-1 gap-x-6 gap-y-1 py-3.5 lg:grid-cols-[minmax(0,1fr)_minmax(12rem,auto)] lg:items-baseline"
            >
              <div className="flex flex-col gap-1">
                <p className="text-corpo text-texto">
                  {linha.antes}
                  {linha.numero ? (
                    <span className="font-mono font-medium tabular-nums">
                      {linha.numero}
                    </span>
                  ) : null}
                  {linha.depois}
                </p>
                {linha.nota ? (
                  <p className="text-apoio text-texto-2">{linha.nota}</p>
                ) : null}
              </div>
              <p className="text-apoio text-texto-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 lg:justify-end lg:text-right">
                <span>{linha.meta}</span>
                {estado ? (
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 font-medium",
                      estado.classe,
                    )}
                  >
                    {estado.Icone ? (
                      <estado.Icone
                        aria-hidden="true"
                        className="size-4"
                        strokeWidth={1.75}
                      />
                    ) : null}
                    {estado.rotulo}
                  </span>
                ) : null}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
