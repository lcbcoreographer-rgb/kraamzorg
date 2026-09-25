import { Cartao } from "@/components/ui/cartao";
import { formatarData } from "@/lib/formatacao";
import type { MetricasAgente } from "../../tipos";

function Estatistica({
  titulo,
  valor,
  meta,
}: {
  titulo: string;
  valor: string;
  meta?: string;
}) {
  return (
    <Cartao variante="plano" className="flex flex-col gap-1">
      <p className="text-apoio text-texto-2">{titulo}</p>
      <p className="text-2 text-texto font-mono font-medium tabular-nums">
        {valor}
      </p>
      {meta ? <p className="text-mini text-texto-2">{meta}</p> : null}
    </Cartao>
  );
}

function pct(valor: number | null): string {
  return valor === null ? "sem dado" : `${valor.toLocaleString("pt-BR")}%`;
}

/**
 * Métricas do agente (P27 item 5, PRD 11.12): número com base de
 * comparação (a meta do PRD), nunca sozinho (DESIGN.md, "KPI sem
 * comparação" é proibido).
 */
export function PainelMetricas({ metricas }: { metricas: MetricasAgente }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-apoio text-texto-2">
        {formatarData(metricas.periodoDesde)} a{" "}
        {formatarData(metricas.periodoAte)}, {metricas.leadsTotal} leads
      </p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Estatistica
          titulo="Tempo da primeira resposta"
          valor={
            metricas.tempoPrimeiraRespostaMinutos === null
              ? "sem dado"
              : `${metricas.tempoPrimeiraRespostaMinutos} min`
          }
          meta="Meta: imediato"
        />
        <Estatistica
          titulo="Leads que respondem à abertura"
          valor={pct(metricas.leadsQueRespondemPct)}
          meta="Meta: 85% ou mais"
        />
        <Estatistica
          titulo="Qualificados com valor e PDF"
          valor={pct(metricas.qualificadosComValorEPdfPct)}
          meta="Meta: 100%"
        />
        <Estatistica
          titulo="Conversas com a Edilaine registradas"
          valor={pct(metricas.conversasComEdilaineRegistradasPct)}
          meta="Meta: 100%, com data"
        />
        <Estatistica
          titulo="Follow-up após o PDF"
          valor={pct(metricas.followupAposPdfPct)}
          meta="Meta: cadência completa em todas"
        />
        <Estatistica
          titulo="Conversão de leads"
          valor={pct(metricas.conversaoLeadsPct)}
          meta="Meta: 7% ou mais"
        />
      </div>
      <Estatistica
        titulo="Condições fora da tabela"
        valor={String(metricas.condicoesForaDaTabela)}
        meta="Meta: só com aprovação registrada"
      />
    </div>
  );
}
