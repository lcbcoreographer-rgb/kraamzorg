import Link from "next/link";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { TabelaLista } from "@/components/ui/tabela-lista";
import type {
  ContagensMarketing,
  FiltroPeriodo,
  RelatorioMarketing,
} from "@/lib/dados/tipos-relacao";
import { formatarData, formatarMoeda } from "@/lib/formatacao";
import { ROTULO_ORIGEM } from "@/modules/relacao/rotulos";
import { atalhosDePeriodo } from "../periodo";

const dividir = (a: number | null, b: number | null): number | null =>
  a !== null && b !== null && b > 0 ? Math.round(a / b) : null;

const dinheiro = (v: number | null) =>
  v === null ? "sem acesso" : formatarMoeda(v);

/** Frase do topo do relatório: número em frase, sem grade de KPIs (DESIGN.md 11.10). */
export function fraseRelatorio(r: RelatorioMarketing): string {
  const t = r.total;
  const partes: string[] = [];
  partes.push(
    t.leads === 0
      ? "Nenhum lead entrou neste período."
      : `${t.leads} ${t.leads === 1 ? "lead entrou" : "leads entraram"} neste período, ${t.qualificados} qualificados e ${t.ganhos} com contrato.`,
  );
  if (r.veValores && t.receitaCentavos !== null) {
    partes.push(
      `Pagamentos confirmados: ${formatarMoeda(t.receitaCentavos)}, de ${t.contratosPagos ?? 0} ${t.contratosPagos === 1 ? "contrato" : "contratos"}.`,
    );
    if ((t.custoCentavos ?? 0) > 0) {
      partes.push(`Custo lançado: ${formatarMoeda(t.custoCentavos ?? 0)}.`);
    }
  }
  return partes.join(" ");
}

function textoPeriodo(p: FiltroPeriodo): string {
  if (!p.desde && !p.ate) return "Todo o período";
  const de = p.desde ? formatarData(p.desde) : "o começo";
  const ate = p.ate ? formatarData(p.ate) : "hoje";
  return `De ${de} a ${ate}`;
}

function celulasValores(c: ContagensMarketing) {
  return {
    leads: String(c.leads),
    qualificados: String(c.qualificados),
    ganhos: String(c.ganhos),
    receita: dinheiro(c.receitaCentavos),
    custo: dinheiro(c.custoCentavos),
    custoLead:
      c.custoCentavos === null
        ? "sem acesso"
        : dividir(c.custoCentavos, c.leads) !== null
          ? formatarMoeda(dividir(c.custoCentavos, c.leads)!)
          : "não se aplica",
    custoContrato:
      c.custoCentavos === null
        ? "sem acesso"
        : dividir(c.custoCentavos, c.contratosPagos) !== null
          ? formatarMoeda(dividir(c.custoCentavos, c.contratosPagos)!)
          : "não se aplica",
  };
}

export function RelatorioMarketingTela({
  relatorio,
  periodo,
}: {
  relatorio: RelatorioMarketing;
  periodo: FiltroPeriodo;
}) {
  const atalhos = atalhosDePeriodo();
  const colunasBase = [
    { chave: "nome", rotulo: "", principal: true },
    { chave: "leads", rotulo: "Leads", numerica: true },
    { chave: "qualificados", rotulo: "Qualificados", numerica: true },
    { chave: "ganhos", rotulo: "Com contrato", numerica: true },
  ];
  const colunasValores = relatorio.veValores
    ? [
        { chave: "receita", rotulo: "Receita", numerica: true },
        { chave: "custo", rotulo: "Custo", numerica: true },
        { chave: "custoLead", rotulo: "Custo por lead", numerica: true },
        {
          chave: "custoContrato",
          rotulo: "Custo por contrato",
          numerica: true,
        },
      ]
    : [];

  return (
    <div className="flex flex-col gap-6">
      <form
        method="get"
        className="flex flex-wrap items-end gap-3"
        aria-label="Período do relatório"
      >
        <label className="text-apoio text-texto flex flex-col gap-1 font-semibold">
          De
          <input
            type="date"
            name="desde"
            defaultValue={periodo.desde ?? ""}
            className="rounded-2 border-borda-campo bg-superficie text-corpo min-h-toque border-[1.5px] px-3 font-normal"
          />
        </label>
        <label className="text-apoio text-texto flex flex-col gap-1 font-semibold">
          Até
          <input
            type="date"
            name="ate"
            defaultValue={periodo.ate ?? ""}
            className="rounded-2 border-borda-campo bg-superficie text-corpo min-h-toque border-[1.5px] px-3 font-normal"
          />
        </label>
        <button
          type="submit"
          className="rounded-pilula border-acao bg-acao text-acao-texto min-h-toque text-apoio border-[1.5px] px-5 font-semibold"
        >
          Ver período
        </button>
        <span className="flex flex-wrap gap-2">
          <Link
            className="text-apoio text-texto underline underline-offset-4"
            href={`/marketing?desde=${atalhos.esteMes.desde}&ate=${atalhos.esteMes.ate}`}
          >
            Este mês
          </Link>
          <Link
            className="text-apoio text-texto underline underline-offset-4"
            href={`/marketing?desde=${atalhos.mesPassado.desde}&ate=${atalhos.mesPassado.ate}`}
          >
            Mês passado
          </Link>
          <Link
            className="text-apoio text-texto underline underline-offset-4"
            href="/marketing"
          >
            Tudo
          </Link>
        </span>
      </form>

      <p
        className="text-corpo text-texto max-w-[64ch]"
        data-teste="frase-relatorio"
      >
        <span className="text-texto-2">{textoPeriodo(periodo)}. </span>
        {fraseRelatorio(relatorio)}
      </p>
      {relatorio.soElegiveis ? (
        <p className="text-apoio text-texto-2 max-w-[64ch]">
          Este relatório conta só famílias que podem receber contato de
          marketing. A receita e o custo aparecem para a diretoria e o
          financeiro.
        </p>
      ) : null}

      <section aria-labelledby="por-origem" className="flex flex-col gap-3">
        <h2
          id="por-origem"
          className="font-titulo text-2 text-texto font-medium"
        >
          Por origem
        </h2>
        {relatorio.porOrigem.length === 0 ? (
          <EstadoVazio
            nivelTitulo="h3"
            titulo="Nenhuma origem neste período"
            texto="Quando entrar um lead, ele aparece aqui na origem que o canal ou a indicação gravou."
          />
        ) : (
          <TabelaLista
            rotulo="Leads e receita por origem"
            colunas={[
              ...colunasBase.map((c) =>
                c.chave === "nome" ? { ...c, rotulo: "Origem" } : c,
              ),
              ...colunasValores,
            ]}
            linhas={relatorio.porOrigem.map((o) => ({
              id: o.origem,
              valores: { nome: ROTULO_ORIGEM[o.origem], ...celulasValores(o) },
            }))}
          />
        )}
      </section>

      <section aria-labelledby="por-canal" className="flex flex-col gap-3">
        <h2
          id="por-canal"
          className="font-titulo text-2 text-texto font-medium"
        >
          Por canal
        </h2>
        {relatorio.porCanal.length === 0 ? (
          <EstadoVazio
            nivelTitulo="h3"
            titulo="Nenhum canal ainda"
            texto="Crie um canal na aba de links para começar a medir de onde as famílias chegam."
          />
        ) : (
          <TabelaLista
            rotulo="Leads e receita por canal"
            colunas={[
              ...colunasBase.map((c) =>
                c.chave === "nome" ? { ...c, rotulo: "Canal" } : c,
              ),
              ...colunasValores,
            ]}
            linhas={relatorio.porCanal.map((c) => ({
              id: c.canalId,
              valores: {
                nome: `${c.nome} (${c.codigo})`,
                ...celulasValores(c),
              },
            }))}
          />
        )}
      </section>
    </div>
  );
}
