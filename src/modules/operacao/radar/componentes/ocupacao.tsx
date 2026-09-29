import { TabelaLista } from "@/components/ui/tabela-lista";
import { Selo } from "@/components/ui/selo";
import type { OcupacaoSemana } from "@/lib/dados/tipos-operacao";
import { formatarData } from "@/lib/formatacao";
import { ocupacaoPorPraca } from "../agrupar";

/**
 * Ocupação projetada por praça e semana (P36 item 2, fluxo C). O número vem
 * da view `ocupacao_projetada`; a linha acima do limite do parâmetro
 * `capacidade_alerta_pct` ganha o selo de aviso, sempre com texto além da cor.
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
    <div className="flex flex-col gap-6">
      {pracas.map((p) => (
        <section
          key={p.regiaoId}
          aria-labelledby={`ocupacao-${p.regiaoId}`}
          className="flex flex-col gap-2"
        >
          <h3
            id={`ocupacao-${p.regiaoId}`}
            className="font-titulo text-2 text-texto font-medium"
          >
            {p.regiao}
          </h3>
          <TabelaLista
            rotulo={`Ocupação projetada de ${p.regiao}`}
            colunas={[
              { chave: "semana", rotulo: "Semana", principal: true },
              { chave: "familias", rotulo: "Famílias", numerica: true },
              { chave: "pct", rotulo: "Ocupação", numerica: true },
              { chave: "estado", rotulo: "Situação", canto: true },
            ]}
            linhas={p.semanas.map((s) => ({
              id: `${s.regiaoId}-${s.semana}`,
              valores: {
                semana: `Semana de ${formatarData(s.semana) ?? s.semana}`,
                familias: String(s.familias),
                pct: `${s.ocupacaoPct}%`,
                estado: s.acimaDoLimite ? (
                  <Selo variante="aviso">
                    {limitePct !== null
                      ? `Acima de ${limitePct}%`
                      : "Acima do limite"}
                  </Selo>
                ) : (
                  <Selo variante="sucesso">Dentro do limite</Selo>
                ),
              },
            }))}
          />
        </section>
      ))}
    </div>
  );
}
