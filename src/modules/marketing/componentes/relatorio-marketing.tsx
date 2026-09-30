import Link from "next/link";
import { CircleCheck, Coins, Compass, Filter, Radio } from "lucide-react";
import { BarrasHorizontais } from "@/components/graficos/barras-horizontais";
import { Broto, FolhaLupa } from "@/components/ilustracoes";
import { CartaoResumo } from "@/components/ui/cartao-resumo";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { TabelaLista } from "@/components/ui/tabela-lista";
import { TileIcone } from "@/components/ui/tile-icone";
import type {
  ContagensMarketing,
  FiltroPeriodo,
  RelatorioMarketing,
} from "@/lib/dados/tipos-relacao";
import { formatarData, formatarMoeda } from "@/lib/formatacao";
import { cn } from "@/lib/utils";
import { ROTULO_ORIGEM } from "@/modules/relacao/rotulos";
import { atalhosDePeriodo } from "../periodo";

const dividir = (a: number | null, b: number | null): number | null =>
  a !== null && b !== null && b > 0 ? Math.round(a / b) : null;

/** Atalho de período em pílula, dentro do bloco lavanda. */
const ATALHO =
  "rounded-pilula text-apoio text-texto hover:bg-lavanda-media min-h-toque ease-estado inline-flex items-center px-3.5 font-semibold no-underline transition-colors duration-140";

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
      {/* O período num bloco de tempo (lavanda, DESIGN.md 2.5). */}
      <form
        method="get"
        className="rounded-3 bg-lavanda-clara flex flex-wrap items-end gap-3 p-4"
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
        <span className="flex flex-wrap gap-1">
          <Link
            className={ATALHO}
            href={`/marketing?desde=${atalhos.esteMes.desde}&ate=${atalhos.esteMes.ate}`}
          >
            Este mês
          </Link>
          <Link
            className={ATALHO}
            href={`/marketing?desde=${atalhos.mesPassado.desde}&ate=${atalhos.mesPassado.ate}`}
          >
            Mês passado
          </Link>
          <Link className={ATALHO} href="/marketing">
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
      {/* Do lead ao contrato: o funil do período em barras (argila, as
          pessoas), e ao lado o dinheiro em número grande, para quem vê
          valores. */}
      <div
        className={cn(
          "grid grid-cols-1 items-start gap-3",
          relatorio.veValores && "lg:grid-cols-[62fr_38fr]",
        )}
      >
        <section
          aria-labelledby="funil"
          className="rounded-3 bg-argila-clara flex flex-col gap-4 p-5 lg:p-6"
        >
          <h3
            id="funil"
            className="font-titulo text-2 text-texto flex items-center gap-3 font-medium"
          >
            <TileIcone tom="argila" forma="quadrado" tamanho="p">
              <Filter />
            </TileIcone>
            Do lead ao contrato
          </h3>
          <BarrasHorizontais
            descricao="Leads do período, quantos foram qualificados e quantos viraram contrato"
            dados={[
              {
                id: "leads",
                rotulo: "Leads",
                valor: relatorio.total.leads,
                valorTexto: String(relatorio.total.leads),
              },
              {
                id: "qualificados",
                rotulo: "Qualificados",
                valor: relatorio.total.qualificados,
                valorTexto: String(relatorio.total.qualificados),
              },
              {
                id: "ganhos",
                rotulo: "Com contrato",
                valor: relatorio.total.ganhos,
                valorTexto: String(relatorio.total.ganhos),
              },
            ]}
          />
        </section>
        {relatorio.veValores ? (
          <div className="tablet:grid-cols-2 grid grid-cols-1 gap-3 lg:grid-cols-1">
            <CartaoResumo
              tom="salvia"
              arranjo="linha"
              icone={<CircleCheck />}
              valor={dinheiro(relatorio.total.receitaCentavos)}
              rotulo="recebidos"
              contexto={`de ${relatorio.total.contratosPagos ?? 0} ${relatorio.total.contratosPagos === 1 ? "contrato" : "contratos"}`}
            />
            <CartaoResumo
              tom="areia"
              arranjo="linha"
              icone={<Coins />}
              valor={dinheiro(relatorio.total.custoCentavos)}
              rotulo="de custo lançado"
              contexto={
                dividir(
                  relatorio.total.custoCentavos,
                  relatorio.total.leads,
                ) !== null
                  ? `${formatarMoeda(dividir(relatorio.total.custoCentavos, relatorio.total.leads)!)} por lead`
                  : "sem lead para dividir"
              }
            />
          </div>
        ) : null}
      </div>

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
          className="font-titulo text-2 text-texto flex items-center gap-3 font-medium"
        >
          <TileIcone tom="areia" forma="quadrado" tamanho="p">
            <Compass />
          </TileIcone>
          Por origem
        </h2>
        {relatorio.porOrigem.length === 0 ? (
          <EstadoVazio
            nivelTitulo="h3"
            ilustracao={<FolhaLupa tamanho={96} />}
            titulo="Nenhuma origem neste período"
            texto="Quando entrar um lead, ele aparece aqui na origem que o canal ou a indicação gravou."
          />
        ) : (
          <div className="min-[720px]:rounded-3 min-[720px]:bg-superficie min-[720px]:shadow-1 min-[720px]:p-2 lg:px-4 lg:py-3">
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
                valores: {
                  nome: ROTULO_ORIGEM[o.origem],
                  ...celulasValores(o),
                },
              }))}
            />
          </div>
        )}
      </section>

      <section aria-labelledby="por-canal" className="flex flex-col gap-3">
        <h2
          id="por-canal"
          className="font-titulo text-2 text-texto flex items-center gap-3 font-medium"
        >
          <TileIcone tom="areia" forma="quadrado" tamanho="p">
            <Radio />
          </TileIcone>
          Por canal
        </h2>
        {relatorio.porCanal.length === 0 ? (
          <EstadoVazio
            nivelTitulo="h3"
            ilustracao={<Broto tamanho={96} />}
            titulo="Nenhum canal ainda"
            texto="Crie um canal na aba de links para começar a medir de onde as famílias chegam."
          />
        ) : (
          <div className="min-[720px]:rounded-3 min-[720px]:bg-superficie min-[720px]:shadow-1 min-[720px]:p-2 lg:px-4 lg:py-3">
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
          </div>
        )}
      </section>
    </div>
  );
}
