import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Selo } from "@/components/ui/selo";
import { exigirSessao } from "@/lib/auth/sessao";
import { obterRepositorios } from "@/lib/dados/fabrica";
import type { DetalheCandidata } from "@/lib/dados/tipos-relacao";
import { formatarData } from "@/lib/formatacao";
import { ROTULO_ESTADO_CANDIDATA } from "@/modules/relacao/rotulos";
import { FormularioAvaliacao } from "@/modules/talentos/componentes/form-avaliacao";
import {
  FormularioCandidata,
  MudarEtapa,
} from "@/modules/talentos/componentes/form-candidata";

export const metadata: Metadata = { title: "Candidata · Kraamzorg OS" };

/** Ficha da candidata: dados, etapa, entrevista pelo roteiro e histórico de avaliações (P51 item 3). */
export default async function PaginaCandidata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await exigirSessao(`/talentos/${id}`);
  let candidata: DetalheCandidata | null = null;
  try {
    candidata = await (await obterRepositorios()).relacao.talentos.obter(id);
  } catch {
    candidata = null;
  }
  if (!candidata) notFound();

  return (
    <div className="flex flex-col gap-8 pt-2">
      <div className="flex flex-col gap-2">
        <Link
          href="/talentos"
          className="text-apoio text-texto-2 underline underline-offset-4"
        >
          Voltar para o banco de talentos
        </Link>
        <h1 className="font-titulo text-display lg:text-display-lg text-texto font-normal">
          {candidata.nome}
        </h1>
        <p className="flex flex-wrap items-center gap-3">
          <Selo variante="neutro">
            {ROTULO_ESTADO_CANDIDATA[candidata.estado]}
          </Selo>
          <span className="text-apoio text-texto-2">
            Chegou em {formatarData(candidata.criadoEm)}, por{" "}
            {candidata.origem === "pagina_publica"
              ? "página pública"
              : "cadastro da equipe"}
            .
          </span>
        </p>
      </div>

      <MudarEtapa candidataId={candidata.id} estado={candidata.estado} />

      <section aria-labelledby="avaliacoes" className="flex flex-col gap-3">
        <h2
          id="avaliacoes"
          className="font-titulo text-1 text-texto font-normal"
        >
          Entrevistas
        </h2>
        {candidata.avaliacoes.length === 0 ? (
          <p className="text-corpo text-texto-2">
            Nenhuma entrevista registrada ainda.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {candidata.avaliacoes.map((a) => (
              <li
                key={a.id}
                className="rounded-3 bg-superficie shadow-1 flex flex-col gap-1 p-4"
              >
                <p className="text-corpo text-texto">
                  {formatarData(a.em)}, por {a.avaliador ?? "equipe"}, roteiro{" "}
                  {a.roteiroVersao}.
                </p>
                <p className="text-apoio text-texto-2">
                  {a.criteriosAvaliados} de {candidata.roteiro.criterios.length}{" "}
                  critérios avaliados
                  {a.media !== null
                    ? `, média ${a.media.toFixed(1).replace(".", ",")}`
                    : ""}
                  .
                </p>
                {a.observacoes ? (
                  <p className="text-corpo text-texto">{a.observacoes}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        aria-labelledby="nova-entrevista"
        className="flex flex-col gap-3"
      >
        <h2
          id="nova-entrevista"
          className="font-titulo text-1 text-texto font-normal"
        >
          Registrar entrevista
        </h2>
        <FormularioAvaliacao
          candidataId={candidata.id}
          roteiro={candidata.roteiro}
        />
      </section>

      <FormularioCandidata candidata={candidata} />
    </div>
  );
}
