import Link from "next/link";
import { cn } from "@/lib/utils";
import { somarMeses } from "@/lib/gestao/financeiro";
import { rotuloMes, mesParaBusca } from "@/lib/gestao/formato";

/**
 * As quatro telas do financeiro da Fase 3 (P46): visão do mês, despesas,
 * pagamento da equipe e conferência do extrato. Mesmo desenho dos filtros de
 * cobranças (pílulas de 44 px).
 */
const TELAS = [
  { href: "/financeiro", rotulo: "Visão do mês" },
  { href: "/financeiro/despesas", rotulo: "Despesas" },
  { href: "/financeiro/equipe", rotulo: "Pagamento da equipe" },
  { href: "/financeiro/extrato", rotulo: "Extrato do banco" },
] as const;

export function NavegacaoFinanceiro({
  atual,
  mes,
}: {
  atual: (typeof TELAS)[number]["href"];
  /** Primeiro dia do mês em vista; as telas mensais levam o mês junto. */
  mes?: string;
}) {
  return (
    <nav aria-label="Telas do financeiro" className="flex flex-wrap gap-2">
      {TELAS.map((t) => {
        const ativo = t.href === atual;
        const comMes = mes && t.href !== "/financeiro/extrato";
        return (
          <Link
            key={t.href}
            href={comMes ? `${t.href}?mes=${mesParaBusca(mes)}` : t.href}
            aria-current={ativo ? "page" : undefined}
            className={cn(
              "rounded-pilula min-h-toque text-apoio inline-flex items-center px-4 font-semibold no-underline",
              ativo
                ? "bg-marinho text-texto-inverso"
                : "border-borda-campo bg-superficie text-texto hover:bg-marinho-08 border-[1.5px]",
            )}
          >
            {t.rotulo}
          </Link>
        );
      })}
    </nav>
  );
}

/** Mês anterior, mês em vista e mês seguinte (o seguinte some no mês atual). */
export function SeletorMes({
  mes,
  hoje,
  caminho,
}: {
  mes: string;
  hoje: string;
  caminho: string;
}) {
  const anterior = somarMeses(mes, -1);
  const seguinte = somarMeses(mes, 1);
  const podeSeguir = seguinte <= `${hoje.slice(0, 7)}-01`;
  const link = (m: string) => `${caminho}?mes=${mesParaBusca(m)}`;
  return (
    <nav
      aria-label="Escolher o mês"
      className="flex flex-wrap items-center gap-2"
    >
      <Link
        href={link(anterior)}
        className="rounded-pilula border-borda-campo bg-superficie text-texto hover:bg-marinho-08 min-h-toque text-apoio inline-flex items-center border-[1.5px] px-4 font-semibold no-underline"
      >
        {rotuloMes(anterior)}
      </Link>
      <span
        aria-current="date"
        className="rounded-pilula bg-marinho text-texto-inverso min-h-toque text-apoio inline-flex items-center px-4 font-semibold"
      >
        {rotuloMes(mes)}
      </span>
      {podeSeguir ? (
        <Link
          href={link(seguinte)}
          className="rounded-pilula border-borda-campo bg-superficie text-texto hover:bg-marinho-08 min-h-toque text-apoio inline-flex items-center border-[1.5px] px-4 font-semibold no-underline"
        >
          {rotuloMes(seguinte)}
        </Link>
      ) : null}
    </nav>
  );
}
