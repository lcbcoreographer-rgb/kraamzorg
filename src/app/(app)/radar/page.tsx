import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { CabecalhoTela } from "@/components/shell/cabecalho-tela";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { exigirSessao } from "@/lib/auth/sessao";
import { obterRepositorios } from "@/lib/dados/fabrica";
import type { Radar, RadarFamilia } from "@/lib/dados/tipos-operacao";
import { cn } from "@/lib/utils";
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

export const metadata: Metadata = { title: "Radar · Kraamzorg OS" };

type Pesquisa = Record<string, string | string[] | undefined>;

function Secao({
  id,
  titulo,
  texto,
  familias,
}: {
  id: string;
  titulo: string;
  texto?: string;
  familias: RadarFamilia[];
}) {
  if (familias.length === 0) return null;
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 id={id} className="font-titulo text-2 text-texto font-medium">
          {titulo}
        </h2>
        {texto ? <p className="text-apoio text-texto-2">{texto}</p> : null}
      </div>
      <ul className="tablet:grid-cols-2 grid grid-cols-1 gap-3">
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

  return (
    <>
      <CabecalhoTela
        titulo="Radar"
        subtitulo="Famílias com parto provável nas próximas semanas, com titular e backup de cada uma. A data provável é uma estimativa e não move nada sozinha."
      />
      <div className="flex flex-col gap-8 pt-6">
        {pracas.length > 1 ? (
          <nav aria-label="Filtrar por praça" className="flex flex-wrap gap-2">
            {[{ regiaoId: "", regiao: "Todas as praças" }, ...pracas].map(
              (p) => {
                const ativa = (p.regiaoId || null) === praca;
                return (
                  <Link
                    key={p.regiaoId || "todas"}
                    href={p.regiaoId ? `/radar?praca=${p.regiaoId}` : "/radar"}
                    aria-current={ativa ? "page" : undefined}
                    className={cn(
                      "rounded-pilula min-h-toque text-apoio inline-flex items-center border-[1.5px] px-4 font-semibold",
                      ativa
                        ? "border-acao bg-acao text-acao-texto"
                        : "border-borda-campo bg-superficie text-texto hover:bg-marinho-08",
                    )}
                  >
                    {p.regiao}
                  </Link>
                );
              },
            )}
          </nav>
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
            titulo="Nenhuma família no radar por enquanto"
            texto="As famílias entram aqui quando o pagamento é confirmado e a data provável do parto cai no horizonte configurado."
          />
        ) : null}

        <Secao
          id="na-janela"
          titulo="Na janela do parto"
          texto="Titular e backup precisam estar aceitos."
          familias={grupos.naJanela}
        />
        <Secao
          id="passaram"
          titulo="Passaram da janela sem nascimento registrado"
          texto="Confirme com a família ou registre o nascimento."
          familias={grupos.passaramDaJanela}
        />
        <Secao
          id="adiante"
          titulo="Nas próximas semanas"
          familias={grupos.adiante}
        />

        {visivel.nasceram.length > 0 ? (
          <section aria-labelledby="nasceram" className="flex flex-col gap-3">
            <h2
              id="nasceram"
              className="font-titulo text-2 text-texto font-medium"
            >
              Já nasceram, aguardando a alta
            </h2>
            <ul className="tablet:grid-cols-2 grid grid-cols-1 gap-3">
              {visivel.nasceram.map((n) => (
                <li key={n.familiaId}>
                  <CartaoNasceu familia={n} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {visivel.ocupacao.length > 0 ? (
          <section aria-labelledby="ocupacao" className="flex flex-col gap-3">
            <h2
              id="ocupacao"
              className="font-titulo text-2 text-texto font-medium"
            >
              Ocupação por praça
            </h2>
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
