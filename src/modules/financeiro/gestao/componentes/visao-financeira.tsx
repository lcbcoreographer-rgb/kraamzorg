import Link from "next/link";
import { BarrasHorizontais } from "@/components/graficos/barras-horizontais";
import { Colunas } from "@/components/graficos/colunas";
import { VerComoTabela } from "@/components/graficos/ver-como-tabela";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { Selo } from "@/components/ui/selo";
import { TabelaLista } from "@/components/ui/tabela-lista";
import { formatarData, formatarMoeda } from "@/lib/formatacao";
import {
  dataCurta,
  formatarMoedaCurta,
  formatarPct,
  nomeMes,
  rotuloMes,
} from "@/lib/gestao/formato";
import { plural, ROTULO_CATEGORIA } from "../textos";
import type { VisaoFinanceira } from "../dados";

/** Frase de abertura da visão do mês. */
export function fraseDoMes(v: VisaoFinanceira): string {
  const { dre } = v;
  const mes = rotuloMes(dre.mes);
  if (dre.receitaCentavos === 0 && dre.despesasCentavos === 0) {
    return `Ainda não há recebimento nem despesa lançados em ${mes}.`;
  }
  const base = `Em ${mes} entraram ${formatarMoeda(dre.receitaCentavos)} e saíram ${formatarMoeda(dre.despesasCentavos)}. `;
  if (dre.receitaCentavos === 0) {
    return `${base}Sem recebimento no mês, ainda não há margem para calcular.`;
  }
  const sinal = dre.resultadoCentavos < 0 ? "negativo" : "positivo";
  return `${base}O resultado é ${sinal}, de ${formatarMoeda(dre.resultadoCentavos)}, com margem de ${formatarPct(dre.margemPct ?? 0)}.`;
}

function fraseInadimplencia(v: VisaoFinanceira): string {
  const i = v.inadimplencia;
  if (i.vencidasQtd === 0) return "Nenhuma cobrança em atraso hoje.";
  return `${plural(i.vencidasQtd, "cobrança está", "cobranças estão")} em atraso, somando ${formatarMoeda(i.vencidoCentavos)}${
    i.taxaPct !== null
      ? `. Isso é ${formatarPct(i.taxaPct)} de tudo o que já venceu ou foi pago`
      : ""
  }.`;
}

function rotuloFaixa(deDias: number, ateDias: number | null): string {
  if (ateDias === null) return `Mais de ${deDias - 1} dias`;
  if (deDias === 1) return `Até ${ateDias} ${ateDias === 1 ? "dia" : "dias"}`;
  return `De ${deDias} a ${ateDias} dias`;
}

/**
 * Visão do mês do financeiro (P46): DRE gerencial em regime de caixa,
 * inadimplência, previsão de recebimentos e os lançamentos que compõem o
 * DRE. O número do painel executivo vem das mesmas funções do banco.
 */
export function VisaoFinanceiraTela({ v }: { v: VisaoFinanceira }) {
  const { dre, inadimplencia, previsao, lancamentos } = v;
  const menor = Math.min(0, ...dre.serie.map((p) => p.resultadoCentavos));
  const despesasComValor = dre.despesasPorCategoria.filter(
    (c) => c.centavos > 0,
  );

  return (
    <div className="flex flex-col gap-8">
      <section
        aria-labelledby="fin-dre"
        className="bg-superficie rounded-3 shadow-1 flex flex-col gap-4 p-5"
      >
        <div className="flex flex-col gap-1">
          <h2
            id="fin-dre"
            className="font-titulo text-2 text-texto font-medium"
          >
            DRE de {rotuloMes(dre.mes)}
          </h2>
          <p className="text-apoio text-texto-2 max-w-[68ch]">
            Regime de caixa: conta o que foi pago no mês. Cobrança estornada ou
            cancelada não entra, e a taxa do meio de pagamento ainda não é
            registrada.
          </p>
        </div>

        <TabelaLista
          rotulo={`DRE de ${rotuloMes(dre.mes)}`}
          colunas={[
            { chave: "linha", rotulo: "Linha", principal: true },
            { chave: "valor", rotulo: "Valor", numerica: true },
          ]}
          linhas={[
            {
              id: "receita",
              valores: {
                linha: "Recebimentos (cobranças pagas)",
                valor: formatarMoeda(dre.receitaCentavos),
              },
            },
            ...dre.despesasPorCategoria.map((c) => ({
              id: c.categoria,
              valores: {
                linha: `Despesa: ${ROTULO_CATEGORIA[c.categoria].toLowerCase()}`,
                valor:
                  c.centavos > 0
                    ? `-${formatarMoeda(c.centavos)}`
                    : formatarMoeda(0),
              },
            })),
            {
              id: "resultado",
              valores: {
                linha: `Resultado${dre.margemPct !== null ? ` (margem de ${formatarPct(dre.margemPct)})` : ""}`,
                valor: formatarMoeda(dre.resultadoCentavos),
              },
            },
          ]}
        />

        {despesasComValor.length > 0 ? (
          <div className="flex flex-col gap-3">
            <h3 className="text-3 text-texto font-semibold">
              Para onde foi o dinheiro
            </h3>
            <BarrasHorizontais
              descricao={`Despesas de ${rotuloMes(dre.mes)} por categoria`}
              dados={despesasComValor.map((c) => ({
                id: c.categoria,
                rotulo: ROTULO_CATEGORIA[c.categoria],
                valor: c.centavos,
                valorTexto: formatarMoeda(c.centavos),
              }))}
            />
          </div>
        ) : null}
      </section>

      <section
        aria-labelledby="fin-serie"
        className="bg-superficie rounded-3 shadow-1 flex flex-col gap-3 p-5"
      >
        <h2
          id="fin-serie"
          className="font-titulo text-2 text-texto font-medium"
        >
          Resultado dos últimos {dre.serie.length} meses
        </h2>
        <Colunas
          descricao={`Resultado de cada um dos últimos ${dre.serie.length} meses, em reais`}
          dados={dre.serie.map((p) => ({
            id: p.mes,
            rotulo: nomeMes(p.mes).slice(0, 3),
            valor: p.resultadoCentavos,
            valorTexto:
              p.mes === dre.mes
                ? formatarMoedaCurta(p.resultadoCentavos)
                : undefined,
            detalhe: [
              rotuloMes(p.mes),
              `Recebimentos: ${formatarMoeda(p.receitaCentavos)}`,
              `Despesas: ${formatarMoeda(p.despesasCentavos)}`,
              `Resultado: ${formatarMoeda(p.resultadoCentavos)}`,
            ],
          }))}
          minimo={menor}
          eixo="moeda"
        />
        <VerComoTabela
          rotulo="Resultado por mês"
          colunas={[
            { chave: "mes", rotulo: "Mês", principal: true },
            { chave: "receita", rotulo: "Recebimentos", numerica: true },
            { chave: "despesas", rotulo: "Despesas", numerica: true },
            { chave: "resultado", rotulo: "Resultado", numerica: true },
          ]}
          linhas={dre.serie.map((p) => ({
            id: p.mes,
            valores: {
              mes: rotuloMes(p.mes),
              receita: formatarMoeda(p.receitaCentavos),
              despesas: formatarMoeda(p.despesasCentavos),
              resultado: formatarMoeda(p.resultadoCentavos),
            },
          }))}
        />
      </section>

      <section
        aria-labelledby="fin-inad"
        className="bg-superficie rounded-3 shadow-1 flex flex-col gap-4 p-5"
      >
        <div className="flex flex-col gap-1">
          <h2
            id="fin-inad"
            className="font-titulo text-2 text-texto font-medium"
          >
            Inadimplência
          </h2>
          <p className="text-corpo text-texto max-w-[68ch]">
            {fraseInadimplencia(v)}
          </p>
        </div>
        {inadimplencia.vencidasQtd > 0 ? (
          <>
            <BarrasHorizontais
              descricao="Cobranças em atraso por faixa de dias"
              dados={inadimplencia.faixas.map((f) => ({
                id: `${f.deDias}`,
                rotulo: rotuloFaixa(f.deDias, f.ateDias),
                apoio: plural(f.qtd, "cobrança", "cobranças"),
                valor: f.centavos,
                valorTexto: formatarMoeda(f.centavos),
              }))}
            />
            <TabelaLista
              rotulo="Cobranças em atraso"
              colunas={[
                { chave: "familia", rotulo: "Família", principal: true },
                { chave: "atraso", rotulo: "Atraso", canto: true },
                { chave: "valor", rotulo: "Valor", numerica: true },
                { chave: "vencimento", rotulo: "Vencimento" },
              ]}
              linhas={inadimplencia.itens.map((c) => ({
                id: c.id,
                valores: {
                  familia: (
                    <Link
                      href={`/cobrancas/${c.id}`}
                      className="text-texto font-semibold underline decoration-1 underline-offset-4"
                    >
                      {c.familiaNome}
                    </Link>
                  ),
                  atraso: (
                    <Selo variante={c.diasAtraso > 30 ? "alerta" : "aviso"}>
                      {plural(c.diasAtraso, "dia", "dias")}
                    </Selo>
                  ),
                  valor: formatarMoeda(c.valorCentavos),
                  vencimento: formatarData(c.vencimento) ?? c.vencimento,
                },
              }))}
            />
          </>
        ) : null}
      </section>

      <section
        aria-labelledby="fin-prev"
        className="bg-superficie rounded-3 shadow-1 flex flex-col gap-3 p-5"
      >
        <div className="flex flex-col gap-1">
          <h2
            id="fin-prev"
            className="font-titulo text-2 text-texto font-medium"
          >
            Previsão de recebimentos
          </h2>
          <p className="text-corpo text-texto max-w-[68ch]">
            {previsao.aVencerCentavos > 0
              ? `Vencem ${formatarMoeda(previsao.aVencerCentavos)} nos próximos ${previsao.meses.length} meses.`
              : `Nenhuma cobrança em aberto vence nos próximos ${previsao.meses.length} meses.`}{" "}
            {previsao.atrasadasCentavos > 0
              ? `Mais ${formatarMoeda(previsao.atrasadasCentavos)} já venceram e seguem em aberto.`
              : ""}
          </p>
          <p className="text-apoio text-texto-2 max-w-[68ch]">
            Só entram as cobranças que já existem. Contrato assinado que ainda
            não gerou cobrança não aparece aqui.
          </p>
        </div>
        <Colunas
          descricao="Valor das cobranças em aberto que vencem em cada mês"
          dados={previsao.meses.map((m) => ({
            id: m.mes,
            rotulo: nomeMes(m.mes).slice(0, 3),
            valor: m.centavos,
            valorTexto:
              m.centavos > 0 ? formatarMoedaCurta(m.centavos) : undefined,
            detalhe: [
              rotuloMes(m.mes),
              `A vencer: ${formatarMoeda(m.centavos)}`,
              plural(m.qtd, "cobrança", "cobranças"),
            ],
          }))}
          eixo="moeda"
        />
      </section>

      <section
        aria-labelledby="fin-lanc"
        className="bg-superficie rounded-3 shadow-1 flex flex-col gap-3 p-5"
      >
        <h2 id="fin-lanc" className="font-titulo text-2 text-texto font-medium">
          Lançamentos de {rotuloMes(lancamentos.mes)}
        </h2>
        <p className="text-apoio text-texto-2 max-w-[68ch]">
          {`A soma destas linhas é o resultado do DRE: ${formatarMoeda(lancamentos.saldoCentavos)}.`}
        </p>
        {lancamentos.lancamentos.length === 0 ? (
          <EstadoVazio
            nivelTitulo="h3"
            titulo="Nenhum lançamento neste mês"
            texto="Os recebimentos aparecem sozinhos quando uma cobrança é paga. As despesas você lança na tela de despesas."
          />
        ) : (
          <VerComoTabela
            rotulo="Lançamentos do mês"
            colunas={[
              { chave: "data", rotulo: "Dia" },
              { chave: "descricao", rotulo: "Descrição", principal: true },
              { chave: "tipo", rotulo: "Tipo", canto: true },
              { chave: "valor", rotulo: "Valor", numerica: true },
            ]}
            linhas={lancamentos.lancamentos.map((l) => ({
              id: `${l.tipo}-${l.id}`,
              valores: {
                data: dataCurta(l.data),
                descricao: l.descricao,
                tipo: (
                  <Selo variante={l.tipo === "receita" ? "sucesso" : "neutro"}>
                    {l.tipo === "receita" ? "Recebimento" : "Despesa"}
                  </Selo>
                ),
                valor:
                  l.tipo === "receita"
                    ? formatarMoeda(l.valorCentavos)
                    : `-${formatarMoeda(l.valorCentavos)}`,
              },
            }))}
            aberta
          />
        )}
      </section>
    </div>
  );
}
