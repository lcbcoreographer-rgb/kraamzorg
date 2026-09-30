import { cn } from "@/lib/utils";

/**
 * Medidor de meta (skill dataviz, "meter"): trilha clara e preenchimento
 * marinho, com o número atual, a meta e a porcentagem escritos ao lado. A cor
 * do preenchimento não muda pelo desempenho (não há regra que diga que 50% da
 * meta no dia 15 é ruim); só muda para `sucesso`, com a palavra "meta atingida",
 * quando o número chega à meta. Sem número atual (ex: NPS sem amostra), a
 * trilha fica vazia e o texto diz por quê.
 */
export function MedidorMeta({
  rotulo,
  atualTexto,
  metaTexto,
  fracao,
  aviso,
  className,
}: {
  rotulo: string;
  /** Número atual já formatado; nulo quando ainda não há como calcular. */
  atualTexto: string | null;
  metaTexto: string;
  /** 0 a 1; nulo sem número atual. */
  fracao: number | null;
  /** Frase que explica a ausência do número (ex: "poucas respostas"). */
  aviso?: string;
  className?: string;
}) {
  const completo = fracao !== null && fracao >= 1;
  const pct = fracao === null ? null : Math.round(fracao * 100);
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <span className="text-apoio text-texto font-medium">{rotulo}</span>
        <span className="text-dado text-texto font-mono">
          {atualTexto ?? "sem número"}{" "}
          <span className="text-texto-2">de {metaTexto}</span>
        </span>
      </div>
      <div
        role="meter"
        aria-label={`${rotulo}: ${atualTexto ?? "sem número"} de ${metaTexto}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct ?? undefined}
        className="bg-marinho-08 rounded-pilula h-3 w-full overflow-hidden"
      >
        <div
          className={cn(
            "rounded-pilula ease-estado h-3 transition-[width] duration-140",
            completo ? "bg-sucesso" : "bg-marinho",
          )}
          style={{
            width: `${Math.max((fracao ?? 0) * 100, fracao ? 1.5 : 0)}%`,
          }}
        />
      </div>
      <p className="text-mini text-texto-2">
        {completo
          ? "Meta atingida."
          : pct !== null
            ? `${pct}% da meta.`
            : (aviso ?? "Ainda não há número para comparar.")}
      </p>
    </div>
  );
}
