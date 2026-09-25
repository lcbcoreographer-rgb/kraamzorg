import Link from "next/link";
import { Cartao } from "@/components/ui/cartao";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
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

function LinhaDuplicata({
  par,
  meta,
}: {
  par: ParDuplicataCerta | ParDuplicataProvavel;
  meta: string;
}) {
  return (
    <Cartao
      variante="plano"
      className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div>
        <p className="text-corpo font-semibold">
          {par.a.nome} <span className="text-texto-2 font-normal">e</span>{" "}
          {par.b.nome}
        </p>
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
          <h2 id="titulo-certas" className="font-titulo text-2 font-medium">
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
          <h2 id="titulo-provaveis" className="font-titulo text-2 font-medium">
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
          <h2 id="titulo-vinculo" className="font-titulo text-2 font-medium">
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
                variante="plano"
                className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-corpo font-semibold">
                    {par.a.nome}{" "}
                    <span className="text-texto-2 font-normal">e</span>{" "}
                    {par.b.nome}
                  </p>
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
