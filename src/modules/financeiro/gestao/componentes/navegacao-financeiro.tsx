import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { FiltroPilula } from "@/components/blocos/filtro-pilula";
import { somarMeses } from "@/lib/gestao/financeiro";
import { rotuloMes, mesParaBusca } from "@/lib/gestao/formato";

/**
 * As quatro telas do financeiro da Fase 3 (P46): visão do mês, despesas,
 * pagamento da equipe e conferência do extrato. Mesmo desenho dos filtros de
 * cobranças: trilha em pílula, a tela atual em branco [v4.4].
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
    <FiltroPilula
      rotulo="Telas do financeiro"
      itens={TELAS.map((t) => {
        const comMes = mes && t.href !== "/financeiro/extrato";
        return {
          rotulo: t.rotulo,
          href: comMes ? `${t.href}?mes=${mesParaBusca(mes)}` : t.href,
          ativo: t.href === atual,
        };
      })}
    />
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
    // O mês como um calendário de bolso (direção "Colo"): trilha lavanda
    // (o tempo), o mês em vista numa pílula branca e os vizinhos com a seta.
    <nav
      aria-label="Escolher o mês"
      className="rounded-pilula bg-lavanda-clara flex w-fit max-w-full flex-wrap items-center gap-1 p-1"
    >
      <Link
        href={link(anterior)}
        className="rounded-pilula text-texto hover:bg-lavanda-media min-h-toque text-apoio ease-estado inline-flex items-center gap-1.5 pr-4 pl-3 font-semibold no-underline transition-colors duration-140"
      >
        <ChevronLeft aria-hidden="true" className="size-4" strokeWidth={1.75} />
        {rotuloMes(anterior)}
      </Link>
      <span
        aria-current="date"
        className="rounded-pilula bg-superficie text-texto shadow-1 min-h-toque text-apoio inline-flex items-center px-4 font-semibold"
      >
        {rotuloMes(mes)}
      </span>
      {podeSeguir ? (
        <Link
          href={link(seguinte)}
          className="rounded-pilula text-texto hover:bg-lavanda-media min-h-toque text-apoio ease-estado inline-flex items-center gap-1.5 pr-3 pl-4 font-semibold no-underline transition-colors duration-140"
        >
          {rotuloMes(seguinte)}
          <ChevronRight
            aria-hidden="true"
            className="size-4"
            strokeWidth={1.75}
          />
        </Link>
      ) : null}
    </nav>
  );
}
