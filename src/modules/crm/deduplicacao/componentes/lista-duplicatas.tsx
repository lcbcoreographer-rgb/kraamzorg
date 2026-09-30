import Link from "next/link";
import { CalendarClock, Phone, Users } from "lucide-react";
import { FolhaLupa } from "@/components/ilustracoes";
import { Cartao } from "@/components/ui/cartao";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { TileIcone } from "@/components/ui/tile-icone";
import { formatarData } from "@/lib/formatacao";
import type { ResultadoDeteccao } from "../deteccao";
import type { ParDuplicataCerta, ParDuplicataProvavel } from "../tipos";
import { VincularNovaGestacao } from "./vincular-nova-gestacao";

function caminhoComparar(par: {
  a: { id: string };
  b: { id: string };
}): string {
  return `/pipeline/duplicatas/${par.a.id}~${par.b.id}`;
}

/**
 * As duas famílias do par como duas pílulas areia (a cor da família,
 * DESIGN.md 2.5) com o "e" entre elas: o texto continua uma frase só
 * ("Família A e Família B"), para quem lê e para o leitor de tela.
 */
function NomesDoPar({ a, b }: { a: string; b: string }) {
  return (
    <p className="text-corpo text-texto flex flex-wrap items-center gap-x-2 gap-y-1.5 font-semibold">
      <span className="rounded-pilula bg-areia-clara px-3 py-1">{a}</span>{" "}
      <span className="text-texto-2 font-normal">e</span>{" "}
      <span className="rounded-pilula bg-areia-clara px-3 py-1">{b}</span>
    </p>
  );
}

function LinhaDuplicata({
  par,
  meta,
}: {
  par: ParDuplicataCerta | ParDuplicataProvavel;
  meta: string;
}) {
  return (
    <Cartao className="tablet:flex-row tablet:items-center tablet:justify-between flex flex-col gap-3">
      <div className="flex min-w-0 flex-col gap-2">
        <NomesDoPar a={par.a.nome} b={par.b.nome} />
        <p className="text-apoio text-texto-2">{meta}</p>
      </div>
      <Link
        href={caminhoComparar(par)}
        className="text-apoio border-borda-campo bg-superficie text-texto min-h-toque rounded-pilula hover:bg-marinho-08 inline-flex items-center justify-center border-[1.5px] px-4 font-semibold whitespace-nowrap"
      >
        Comparar e mesclar
      </Link>
    </Cartao>
  );
}

/**
 * Tela de duplicatas (P17 item 1): duplicata certa por telefone,
 * duplicata provável por nome parecido e DPP próxima, e vínculo de nova
 * gestação quando o telefone bate mas as datas estão muito distantes
 * (PRD 6.10 regra 12: liga, não mescla).
 */
export function ListaDuplicatas({
  resultado,
}: {
  resultado: ResultadoDeteccao;
}) {
  if (resultado.indisponivelNoBanco) {
    return (
      <FaixaAlerta
        variante="info"
        titulo="O banco ainda não tem a função de duplicatas"
      >
        A detecção de duplicatas (`api.buscar_duplicatas`) está sendo escrita em
        outra trilha. Assim que ela chegar, esta tela passa a mostrar os pares
        de verdade.
      </FaixaAlerta>
    );
  }

  const semNada =
    resultado.certas.length === 0 &&
    resultado.provaveis.length === 0 &&
    resultado.novasGestacoes.length === 0;

  if (semNada) {
    return (
      <EstadoVazio
        nivelTitulo="h2"
        ilustracao={<FolhaLupa tamanho={104} />}
        titulo="Nenhuma duplicata encontrada"
        texto="Quando duas famílias tiverem o mesmo telefone ou nomes parecidos com DPP próxima, elas aparecem aqui."
      />
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {resultado.certas.length > 0 ? (
        <section
          aria-labelledby="titulo-certas"
          className="flex flex-col gap-3"
        >
          <h2
            id="titulo-certas"
            className="font-titulo text-2 text-texto flex items-center gap-3 font-medium"
          >
            <TileIcone tom="argila" forma="quadrado">
              <Phone />
            </TileIcone>
            Duplicata certa
          </h2>
          <p className="text-apoio text-texto-2">Mesmo telefone cadastrado.</p>
          {resultado.certas.map((par) => (
            <LinhaDuplicata
              key={caminhoComparar(par)}
              par={par}
              meta={`Telefone em comum: ${par.telefone}`}
            />
          ))}
        </section>
      ) : null}

      {resultado.provaveis.length > 0 ? (
        <section
          aria-labelledby="titulo-provaveis"
          className="flex flex-col gap-3"
        >
          <h2
            id="titulo-provaveis"
            className="font-titulo text-2 text-texto flex items-center gap-3 font-medium"
          >
            <TileIcone tom="areia" forma="quadrado">
              <Users />
            </TileIcone>
            Provável duplicata
          </h2>
          <p className="text-apoio text-texto-2">
            Nomes parecidos, com DPP a até 14 dias de diferença.
          </p>
          {resultado.provaveis.map((par) => (
            <LinhaDuplicata
              key={caminhoComparar(par)}
              par={par}
              meta={`Nomes ${Math.round(par.similaridade * 100)}% parecidos${
                par.diasEntreDpp !== null
                  ? `, DPP a ${par.diasEntreDpp} dias de diferença`
                  : ""
              }`}
            />
          ))}
        </section>
      ) : null}

      {resultado.novasGestacoes.length > 0 ? (
        <section
          aria-labelledby="titulo-vinculo"
          className="flex flex-col gap-3"
        >
          <h2
            id="titulo-vinculo"
            className="font-titulo text-2 text-texto flex items-center gap-3 font-medium"
          >
            <TileIcone tom="lavanda" forma="quadrado">
              <CalendarClock />
            </TileIcone>
            Pode ser nova gestação
          </h2>
          <p className="text-apoio text-texto-2">
            Mesmo telefone, mas com datas muito distantes: provavelmente não é a
            mesma gestação. Liga as duas famílias sem mesclar nenhum dado.
          </p>
          {resultado.novasGestacoes.map((par) => {
            const [recente, anterior] =
              !par.a.dpp || (par.b.dpp && par.b.dpp < par.a.dpp)
                ? [par.a, par.b]
                : [par.b, par.a];
            return (
              <Cartao
                key={caminhoComparar(par)}
                className="tablet:flex-row tablet:items-center tablet:justify-between flex flex-col gap-3"
              >
                <div className="flex min-w-0 flex-col gap-2">
                  <NomesDoPar a={par.a.nome} b={par.b.nome} />
                  <p className="text-apoio text-texto-2">
                    Telefone em comum: {par.telefone}
                    {par.a.dpp
                      ? ` · DPP de ${par.a.nome}: ${formatarData(par.a.dpp)}`
                      : ""}
                    {par.b.dpp
                      ? ` · DPP de ${par.b.nome}: ${formatarData(par.b.dpp)}`
                      : ""}
                  </p>
                </div>
                <VincularNovaGestacao
                  familiaRecenteId={recente.id}
                  familiaAnteriorId={anterior.id}
                  familiaAnteriorNome={anterior.nome}
                />
              </Cartao>
            );
          })}
        </section>
      ) : null}
    </div>
  );
}
