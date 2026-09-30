import type { Metadata } from "next";
import type { ReactNode } from "react";
import {
  CalendarClock,
  CalendarDays,
  CalendarX2,
  ChartNoAxesColumn,
  Hospital,
} from "lucide-react";
import { z } from "zod";
import { FolhaLupa } from "@/components/ilustracoes";
import { CabecalhoTela } from "@/components/shell/cabecalho-tela";
import { AbasPilula } from "@/components/ui/abas-pilula";
import { CartaoResumo } from "@/components/ui/cartao-resumo";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import type { Tom } from "@/components/ui/tons";
import { exigirSessao } from "@/lib/auth/sessao";
import { obterRepositorios } from "@/lib/dados/fabrica";
import type { Radar, RadarFamilia } from "@/lib/dados/tipos-operacao";
import { TituloSecao } from "@/modules/operacao/comum/titulo-secao";
import {
  agruparRadar,
  contarUrgentes,
  filtrarPorPraca,
  pracasDoRadar,
} from "@/modules/operacao/radar/agrupar";
import {
  CartaoNasceu,
  CartaoRadar,
} from "@/modules/operacao/radar/componentes/cartao-radar";
import { OcupacaoPorPraca } from "@/modules/operacao/radar/componentes/ocupacao";
import { fraseDias } from "@/modules/operacao/comum/rotulos";

export const metadata: Metadata = { title: "Radar · Kraamzorg OS" };

type Pesquisa = Record<string, string | string[] | undefined>;

function Secao({
  id,
  titulo,
  texto,
  familias,
  icone,
  tom,
}: {
  id: string;
  titulo: string;
  texto?: string;
  familias: RadarFamilia[];
  icone: ReactNode;
  tom: Tom;
}) {
  if (familias.length === 0) return null;
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4">
      <TituloSecao
        id={id}
        icone={icone}
        tom={tom}
        titulo={titulo}
        contagem={familias.length}
        unidade={familias.length === 1 ? "família" : "famílias"}
        texto={texto}
      />
      <ul className="tablet:grid-cols-2 grid grid-cols-1 gap-3 xl:grid-cols-3">
        {familias.map((f) => (
          <li key={f.familiaId}>
            <CartaoRadar familia={f} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Radar de nascimentos (P36 item 2, fluxo C): famílias com pagamento
 * confirmado pela janela da data provável do parto, com titular e backup, o
 * que está sem contato, os check-ins pendentes, quem já nasceu e a ocupação
 * por praça. A DPP é estimativa: ela ordena a tela, nunca dispara algo
 * sozinha. Só coordenação e diretoria (PRD 13).
 */
export default async function PaginaRadar({
  searchParams,
}: {
  searchParams: Promise<Pesquisa>;
}) {
  await exigirSessao("/radar");
  const pesquisa = await searchParams;
  const pedida = Array.isArray(pesquisa.praca)
    ? pesquisa.praca[0]
    : pesquisa.praca;
  const praca = z.uuid().safeParse(pedida).success ? (pedida as string) : null;

  let radar: Radar | null = null;
  try {
    const { operacao } = await obterRepositorios();
    radar = await operacao.radar(null);
  } catch {
    radar = null;
  }

  if (!radar) {
    return (
      <>
        <CabecalhoTela titulo="Radar" />
        <div className="pt-6">
          <FaixaAlerta variante="erro" titulo="O radar não abriu agora">
            Confira a conexão e recarregue a página. Nada foi alterado.
          </FaixaAlerta>
        </div>
      </>
    );
  }

  const pracas = pracasDoRadar(radar);
  const visivel = filtrarPorPraca(radar, praca);
  const grupos = agruparRadar(visivel.familias);
  const urgentes = contarUrgentes(visivel.familias);
  const vazio = visivel.familias.length === 0 && visivel.nasceram.length === 0;
  const semDupla = grupos.naJanela.filter(
    (f) => f.titular?.status !== "aceita" || f.backup?.status !== "aceita",
  ).length;
  const proxima = grupos.adiante.reduce<RadarFamilia | null>(
    (menor, f) => (!menor || f.diasParaDpp < menor.diasParaDpp ? f : menor),
    null,
  );

  return (
    <>
      <CabecalhoTela
        titulo="Radar"
        subtitulo="Famílias com parto provável nas próximas semanas, com titular e backup de cada uma. A data provável é uma estimativa e não move nada sozinha."
      />
      <div className="flex flex-col gap-10 pt-6">
        {pracas.length > 1 ? (
          <AbasPilula
            rotulo="Filtrar por praça"
            ativa={praca ?? ""}
            abas={[{ regiaoId: "", regiao: "Todas as praças" }, ...pracas].map(
              (p) => ({
                valor: p.regiaoId,
                rotulo: p.regiao,
                href: p.regiaoId ? `/radar?praca=${p.regiaoId}` : "/radar",
              }),
            )}
          />
        ) : null}

        {!vazio ? (
          <div className="tablet:grid-cols-3 -mt-4 grid grid-cols-2 gap-2 lg:gap-3">
            <CartaoResumo
              destaque
              className="tablet:col-span-1 col-span-2"
              tom="dourado"
              icone={<CalendarClock />}
              valor={grupos.naJanela.length}
              rotulo={
                grupos.naJanela.length === 1
                  ? "família na janela do parto"
                  : "famílias na janela do parto"
              }
              contexto={
                grupos.naJanela.length === 0
                  ? "ninguém perto do parto agora"
                  : semDupla === 0
                    ? "titular e backup aceitos em todas"
                    : semDupla === 1
                      ? "1 ainda sem a dupla aceita"
                      : `${semDupla} ainda sem a dupla aceita`
              }
              href={grupos.naJanela.length > 0 ? "#na-janela" : undefined}
            />
            <CartaoResumo
              tom="lavanda"
              icone={<CalendarDays />}
              valor={grupos.adiante.length}
              rotulo="nas próximas semanas"
              contexto={
                proxima
                  ? `a próxima data provável ${fraseDias(proxima.diasParaDpp)}`
                  : "nenhuma família adiante"
              }
              href={grupos.adiante.length > 0 ? "#adiante" : undefined}
            />
            <CartaoResumo
              tom="areia"
              icone={<Hospital />}
              valor={visivel.nasceram.length}
              rotulo={
                visivel.nasceram.length === 1
                  ? "já nasceu, espera a alta"
                  : "já nasceram, esperam a alta"
              }
              contexto={
                visivel.nasceram.length === 0
                  ? "nenhuma alta a registrar"
                  : "a próxima ação é registrar a alta"
              }
              href={visivel.nasceram.length > 0 ? "#nasceram" : undefined}
            />
          </div>
        ) : null}

        {urgentes > 0 ? (
          <FaixaAlerta
            variante="prioritario"
            titulo={
              urgentes === 1
                ? "1 família precisa de você agora"
                : `${urgentes} famílias precisam de você agora`
            }
          >
            Sem titular na janela do parto ou com a data provável passada sem
            resposta. Abra a alocação de cada uma para resolver.
          </FaixaAlerta>
        ) : null}

        {vazio ? (
          <EstadoVazio
            nivelTitulo="h2"
            ilustracao={praca ? <FolhaLupa tamanho={112} /> : undefined}
            titulo={
              praca
                ? "Nenhuma família no radar nesta praça"
                : "Nenhuma família no radar por enquanto"
            }
            texto="As famílias entram aqui quando o pagamento é confirmado e a data provável do parto cai no horizonte configurado."
          />
        ) : null}

        <Secao
          id="na-janela"
          titulo="Na janela do parto"
          texto="Titular e backup precisam estar aceitos."
          familias={grupos.naJanela}
          icone={<CalendarClock />}
          tom="dourado"
        />
        <Secao
          id="passaram"
          titulo="Passaram da janela sem nascimento registrado"
          texto="Confirme com a família ou registre o nascimento."
          familias={grupos.passaramDaJanela}
          icone={<CalendarX2 />}
          tom="areia"
        />
        <Secao
          id="adiante"
          titulo="Nas próximas semanas"
          familias={grupos.adiante}
          icone={<CalendarDays />}
          tom="lavanda"
        />

        {visivel.nasceram.length > 0 ? (
          <section aria-labelledby="nasceram" className="flex flex-col gap-4">
            <TituloSecao
              id="nasceram"
              icone={<Hospital />}
              tom="areia"
              titulo="Já nasceram, aguardando a alta"
              contagem={visivel.nasceram.length}
              unidade={visivel.nasceram.length === 1 ? "família" : "famílias"}
            />
            <ul className="tablet:grid-cols-2 grid grid-cols-1 gap-3 xl:grid-cols-3">
              {visivel.nasceram.map((n) => (
                <li key={n.familiaId}>
                  <CartaoNasceu familia={n} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {visivel.ocupacao.length > 0 ? (
          <section aria-labelledby="ocupacao" className="flex flex-col gap-4">
            <TituloSecao
              id="ocupacao"
              icone={<ChartNoAxesColumn />}
              tom="lavanda"
              titulo="Ocupação por praça"
              texto="Quantas famílias cada praça vai atender em cada semana, pela data provável."
            />
            <OcupacaoPorPraca
              ocupacao={visivel.ocupacao}
              limitePct={visivel.limiteAlertaPct}
            />
          </section>
        ) : null}
      </div>
    </>
  );
}
