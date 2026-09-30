import Link from "next/link";
import type { ReactNode } from "react";
import { BarrasHorizontais } from "@/components/graficos/barras-horizontais";
import { Colunas } from "@/components/graficos/colunas";
import { MedidorMeta } from "@/components/graficos/medidor-meta";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { formatarMoeda } from "@/lib/formatacao";
import { formatarPct } from "@/lib/gestao/formato";
import {
  INDICADORES,
  progressoDasMetas,
  type SecaoPainel,
} from "@/lib/gestao/painel";
import { ROTULO_ORIGEM } from "@/modules/financeiro/gestao/textos";
import type { DadosPainel } from "../dados";
import {
  PERGUNTAS,
  avisoDaMeta,
  colunasDaCapacidade,
  contraAnterior,
  contraAnteriorPct,
  fraseDeExperiencia,
  fraseDeFinanceiro,
  frasesDeOperacao,
  textoDaMeta,
  textoDoCongelamento,
} from "../textos";

function Secao({
  id,
  secao,
  frase,
  children,
}: {
  id: string;
  secao: SecaoPainel;
  frase: string;
  children: ReactNode;
}) {
  const indicadores = INDICADORES.filter((i) => i.secao === secao);
  return (
    <section
      aria-labelledby={id}
      className="bg-superficie rounded-3 shadow-1 flex flex-col gap-4 p-5"
    >
      <div className="flex flex-col gap-1">
        <h2 id={id} className="font-titulo text-2 text-texto font-medium">
          {PERGUNTAS[secao]}
        </h2>
        <p className="text-corpo text-texto max-w-[68ch]">{frase}</p>
      </div>
      {children}
      <details className="group">
        <summary className="text-apoio text-texto min-h-toque inline-flex cursor-pointer list-none items-center font-semibold underline decoration-1 underline-offset-4 [&::-webkit-details-marker]:hidden">
          De onde vêm estes números
        </summary>
        <ul className="mt-2 flex flex-col gap-2">
          {indicadores.map((i) => (
            <li key={i.id} className="text-apoio text-texto-2 max-w-[68ch]">
              <span className="text-texto font-semibold">{i.rotulo}.</span>{" "}
              {i.definicao}
              {i.tela ? (
                <>
                  {" "}
                  <Link
                    href={i.tela.href}
                    className="text-texto font-semibold underline decoration-1 underline-offset-4"
                  >
                    Ver em {i.tela.rotulo}
                  </Link>
                  .
                </>
              ) : null}
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}

/** Uma linha do painel: rótulo, valor e a comparação logo abaixo. */
function Numero({
  rotulo,
  valor,
  comparacao,
  destaque,
}: {
  rotulo: string;
  valor: string;
  comparacao?: string;
  destaque?: boolean;
}) {
  return (
    <div className="border-linha flex flex-wrap items-baseline justify-between gap-x-4 border-b py-2 last:border-b-0">
      <dt className="text-apoio text-texto-2">{rotulo}</dt>
      <dd className="text-right">
        <span
          className={
            destaque
              ? "text-1 text-texto font-mono"
              : "text-dado-lg text-texto font-mono"
          }
        >
          {valor}
        </span>
        {comparacao ? (
          <span className="text-mini text-texto-2 block">{comparacao}</span>
        ) : null}
      </dd>
    </div>
  );
}

const semDado = "sem número";

/**
 * Painel executivo (P52, PRD 16.2): as cinco perguntas da diretoria, com as
 * metas da Kraamzorg e a contagem do congelamento. Todo número tem a consulta
 * documentada (docs/painel/consultas.md) e é o mesmo da tela de origem.
 */
export function PainelTela({ dados }: { dados: DadosPainel }) {
  const { atual: p, anterior: a } = dados;
  const mes = p.mes;
  const metas = progressoDasMetas(p.metas, p.progresso);
  const c = p.comercial;
  const m = p.marketing;
  const o = p.operacao;
  const e = p.experiencia;
  const f = p.financeiro;

  const regioes = [...new Set(o.capacidade.map((x) => x.regiao))].sort((x, y) =>
    x.localeCompare(y, "pt-BR"),
  );

  return (
    <div className="flex flex-col gap-8">
      <section
        aria-labelledby="painel-metas"
        className="bg-superficie rounded-3 shadow-1 flex flex-col gap-4 p-5"
      >
        <h2
          id="painel-metas"
          className="font-titulo text-2 text-texto font-medium"
        >
          As metas do mês
        </h2>
        <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
          {metas.map((meta) => {
            const t = textoDaMeta(meta);
            return (
              <MedidorMeta
                key={meta.chave}
                rotulo={meta.rotulo}
                atualTexto={t.atualTexto}
                metaTexto={t.metaTexto}
                fracao={meta.fracao}
                aviso={avisoDaMeta(meta, e.amostraMinima)}
              />
            );
          })}
        </div>
        {p.congelamento ? (
          <p className="text-apoio text-texto-2">
            {textoDoCongelamento(p.congelamento)}
          </p>
        ) : null}
      </section>

      {o.semanasEmSobrevenda > 0 ? (
        <FaixaAlerta
          variante="prioritario"
          titulo={`${o.semanasEmSobrevenda} ${o.semanasEmSobrevenda === 1 ? "semana" : "semanas"} com chance de sobrevenda nas próximas ${o.capacidadeSemanas}`}
          acoes={
            <Link
              href="/capacidade"
              className="text-texto text-apoio font-semibold underline decoration-1 underline-offset-4"
            >
              Ver a capacidade
            </Link>
          }
        >
          Vale conversar sobre novos contratos nas regiões marcadas antes de
          fechar mais famílias.
        </FaixaAlerta>
      ) : null}

      <Secao
        id="painel-comercial"
        secao="comercial"
        frase={
          c.leads === 0 && c.contratosAssinados === 0
            ? "Ainda não há lead nem contrato neste mês."
            : `${c.leads} ${c.leads === 1 ? "lead chegou" : "leads chegaram"}, ${c.sessoesRealizadas} ${c.sessoesRealizadas === 1 ? "sessão foi feita" : "sessões foram feitas"} e ${c.contratosAssinados} ${c.contratosAssinados === 1 ? "contrato foi assinado" : "contratos foram assinados"}.`
        }
      >
        <dl>
          <Numero
            rotulo="Leads novos"
            valor={String(c.leads)}
            comparacao={contraAnterior(c.leads, a?.comercial.leads, mes)}
          />
          <Numero
            rotulo="Sessões realizadas"
            valor={String(c.sessoesRealizadas)}
            comparacao={contraAnterior(
              c.sessoesRealizadas,
              a?.comercial.sessoesRealizadas,
              mes,
            )}
          />
          <Numero
            rotulo="Contratos assinados"
            valor={String(c.contratosAssinados)}
            comparacao={contraAnterior(
              c.contratosAssinados,
              a?.comercial.contratosAssinados,
              mes,
            )}
          />
          <Numero
            rotulo="Conversão"
            valor={
              c.conversaoPct === null ? semDado : formatarPct(c.conversaoPct)
            }
            comparacao={contraAnteriorPct(
              c.conversaoPct,
              a?.comercial.conversaoPct,
              mes,
            )}
          />
          <Numero
            rotulo="Faturamento"
            valor={formatarMoeda(c.faturamentoCentavos)}
            comparacao={contraAnterior(
              c.faturamentoCentavos,
              a?.comercial.faturamentoCentavos,
              mes,
              formatarMoeda,
            )}
          />
          <Numero
            rotulo="Ticket médio"
            valor={
              c.ticketMedioCentavos === null
                ? semDado
                : formatarMoeda(c.ticketMedioCentavos)
            }
          />
        </dl>
      </Secao>

      <Secao
        id="painel-marketing"
        secao="marketing"
        frase={
          m.leadsPorOrigem.length === 0
            ? "Ainda não há lead com origem neste mês."
            : `O canal que mais trouxe famílias foi ${ROTULO_ORIGEM[m.leadsPorOrigem[0]?.origem ?? "desconhecida"].toLowerCase()}, com ${m.leadsPorOrigem[0]?.leads} ${m.leadsPorOrigem[0]?.leads === 1 ? "lead" : "leads"}. O custo de marketing do mês foi ${formatarMoeda(m.custoTotalCentavos)}.`
        }
      >
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="flex flex-col gap-3">
            <h3 className="text-3 text-texto font-semibold">
              Leads por origem
            </h3>
            {m.leadsPorOrigem.length === 0 ? (
              <p className="text-apoio text-texto-2">Nenhum lead neste mês.</p>
            ) : (
              <BarrasHorizontais
                descricao="Leads do mês por origem"
                dados={m.leadsPorOrigem.map((x) => ({
                  id: x.origem,
                  rotulo: ROTULO_ORIGEM[x.origem],
                  valor: x.leads,
                  valorTexto: String(x.leads),
                }))}
              />
            )}
          </div>
          <div className="flex flex-col gap-3">
            <h3 className="text-3 text-texto font-semibold">Custo por canal</h3>
            {m.custoPorCanal.length === 0 ? (
              <p className="text-apoio text-texto-2">
                Nenhum gasto de marketing lançado neste mês. Lance as despesas
                de anúncios, com o canal, em{" "}
                <Link
                  href="/financeiro/despesas"
                  className="text-texto font-semibold underline decoration-1 underline-offset-4"
                >
                  Despesas
                </Link>
                .
              </p>
            ) : (
              <BarrasHorizontais
                descricao="Custo de marketing do mês por canal"
                dados={m.custoPorCanal.map((x) => ({
                  id: x.canal ?? "sem-canal",
                  rotulo: x.canal
                    ? ROTULO_ORIGEM[x.canal]
                    : "Sem canal informado",
                  valor: x.centavos,
                  valorTexto: formatarMoeda(x.centavos),
                }))}
              />
            )}
          </div>
          <div className="flex flex-col gap-3">
            <h3 className="text-3 text-texto font-semibold">
              Receita por origem
            </h3>
            {m.receitaPorOrigem.length === 0 ? (
              <p className="text-apoio text-texto-2">
                Nenhum pagamento recebido neste mês.
              </p>
            ) : (
              <BarrasHorizontais
                descricao="Receita do mês por origem da família"
                dados={m.receitaPorOrigem.map((x) => ({
                  id: x.origem,
                  rotulo: ROTULO_ORIGEM[x.origem],
                  valor: x.centavos,
                  valorTexto: formatarMoeda(x.centavos),
                }))}
              />
            )}
          </div>
          <div className="flex flex-col gap-3">
            <h3 className="text-3 text-texto font-semibold">
              Receita por campanha
            </h3>
            {m.receitaPorCampanha.length === 0 ? (
              <p className="text-apoio text-texto-2">
                Nenhuma campanha com código de origem recebeu neste mês. As
                campanhas aparecem quando os links de WhatsApp por canal, com o
                código de origem, estiverem em uso.
              </p>
            ) : (
              <BarrasHorizontais
                descricao="Receita do mês por campanha"
                dados={m.receitaPorCampanha.map((x) => ({
                  id: x.campanha,
                  rotulo: x.campanha,
                  valor: x.centavos,
                  valorTexto: formatarMoeda(x.centavos),
                }))}
              />
            )}
          </div>
        </div>
      </Secao>

      <Secao id="painel-operacao" secao="operacao" frase={frasesDeOperacao(p)}>
        <dl>
          <Numero rotulo="Famílias ativas" valor={String(o.familiasAtivas)} />
          <Numero
            rotulo="Famílias que começaram no mês"
            valor={String(o.familiasIniciadas)}
            comparacao={contraAnterior(
              o.familiasIniciadas,
              a?.operacao.familiasIniciadas,
              mes,
            )}
          />
          <Numero
            rotulo="Visitas realizadas"
            valor={String(o.visitasRealizadas)}
            comparacao={contraAnterior(
              o.visitasRealizadas,
              a?.operacao.visitasRealizadas,
              mes,
            )}
          />
          <Numero
            rotulo="Ocorrências abertas"
            valor={String(o.ocorrenciasAbertas)}
          />
        </dl>
        <div className="flex flex-col gap-4">
          <h3 className="text-3 text-texto font-semibold">
            Capacidade das próximas {o.capacidadeSemanas} semanas
          </h3>
          {regioes.map((regiao) => (
            <div key={regiao} className="flex flex-col gap-1">
              <p className="text-apoio text-texto font-semibold">{regiao}</p>
              <Colunas
                descricao={`Ocupação de ${regiao} nas próximas ${o.capacidadeSemanas} semanas`}
                dados={colunasDaCapacidade(
                  o.capacidade.filter((x) => x.regiao === regiao),
                )}
                eixo="porcentagem"
                legenda={
                  regiao === regioes[regioes.length - 1]
                    ? [
                        { estado: "neutro", rotulo: "Tranquila" },
                        { estado: "atencao", rotulo: "Atenção" },
                        { estado: "alerta", rotulo: "Sobrevenda provável" },
                      ]
                    : undefined
                }
              />
            </div>
          ))}
          <Link
            href="/capacidade"
            className="text-texto text-apoio min-h-toque inline-flex items-center self-start font-semibold underline decoration-1 underline-offset-4"
          >
            Ver a capacidade com a tabela e o backup
          </Link>
        </div>
      </Secao>

      <Secao
        id="painel-experiencia"
        secao="experiencia"
        frase={fraseDeExperiencia(p)}
      >
        <dl>
          <Numero
            rotulo="NPS"
            valor={e.nps === null ? semDado : String(e.nps)}
            comparacao={
              e.nps !== null
                ? contraAnterior(e.nps, a?.experiencia.nps, mes)
                : undefined
            }
            destaque
          />
          <Numero
            rotulo="Respostas da pesquisa"
            valor={String(e.respostas)}
            comparacao={contraAnterior(
              e.respostas,
              a?.experiencia.respostas,
              mes,
            )}
          />
          <Numero
            rotulo="Indicações"
            valor={String(e.indicacoes)}
            comparacao={contraAnterior(
              e.indicacoes,
              a?.experiencia.indicacoes,
              mes,
            )}
          />
          <Numero
            rotulo="Depoimentos autorizados"
            valor={String(e.depoimentos)}
          />
        </dl>
      </Secao>

      <Secao
        id="painel-financeiro"
        secao="financeiro"
        frase={fraseDeFinanceiro(p)}
      >
        <dl>
          <Numero
            rotulo="Recebimentos"
            valor={formatarMoeda(f.recebimentosCentavos)}
            comparacao={contraAnterior(
              f.recebimentosCentavos,
              a?.financeiro.recebimentosCentavos,
              mes,
              formatarMoeda,
            )}
          />
          <Numero
            rotulo="Custos"
            valor={formatarMoeda(f.custosCentavos)}
            comparacao={contraAnterior(
              f.custosCentavos,
              a?.financeiro.custosCentavos,
              mes,
              formatarMoeda,
            )}
          />
          <Numero
            rotulo="Resultado"
            valor={formatarMoeda(f.resultadoCentavos)}
            comparacao={contraAnterior(
              f.resultadoCentavos,
              a?.financeiro.resultadoCentavos,
              mes,
              formatarMoeda,
            )}
            destaque
          />
          <Numero
            rotulo="Margem"
            valor={f.margemPct === null ? semDado : formatarPct(f.margemPct)}
            comparacao={contraAnteriorPct(
              f.margemPct,
              a?.financeiro.margemPct,
              mes,
            )}
          />
          <Numero
            rotulo="Inadimplência"
            valor={
              f.inadimplenciaPct === null
                ? semDado
                : formatarPct(f.inadimplenciaPct)
            }
            comparacao={
              f.vencidoCentavos > 0
                ? `${formatarMoeda(f.vencidoCentavos)} vencidos e em aberto.`
                : "Nada vencido em aberto."
            }
          />
          <Numero
            rotulo="A receber nos próximos meses"
            valor={formatarMoeda(f.previsaoAVencerCentavos)}
            comparacao={
              f.previsaoAtrasadasCentavos > 0
                ? `Mais ${formatarMoeda(f.previsaoAtrasadasCentavos)} já venceram.`
                : undefined
            }
          />
          <Numero
            rotulo="Faturamento do mês"
            valor={formatarMoeda(f.faturamentoCentavos)}
            comparacao="Contratos assinados no mês."
          />
        </dl>
        <Link
          href="/financeiro"
          className="text-texto text-apoio min-h-toque inline-flex items-center self-start font-semibold underline decoration-1 underline-offset-4"
        >
          Ver o DRE, as despesas e a previsão
        </Link>
      </Secao>
    </div>
  );
}
