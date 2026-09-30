import type { Metadata } from "next";
import { exigirSessao } from "@/lib/auth/sessao";
import {
  ConteudoListaEvolucoes,
  situacaoDaBusca,
} from "@/modules/assistencial/evolucao/componentes/conteudo-lista";

export const metadata: Metadata = { title: "Evoluções · Kraamzorg OS" };

/**
 * Evoluções de enfermagem aos médicos (P41, PRD 9.5): os acompanhamentos que
 * terminaram, o prazo de cada um e o estado dos documentos. A coordenação
 * revisa, aprova e envia; a diretoria lê.
 */
export default async function PaginaEvolucoes({
  searchParams,
}: {
  searchParams: Promise<{ situacao?: string }>;
}) {
  const { situacao } = await searchParams;
  await exigirSessao("/evolucoes");
  return (
    <div className="flex flex-col gap-6 pt-2">
      <h1 className="font-titulo text-display lg:text-display-lg text-texto font-normal">
        Evoluções
      </h1>
      <ConteudoListaEvolucoes
        filtro={situacaoDaBusca(situacao)}
        base="/evolucoes"
        baseFamilia="/familias"
      />
    </div>
  );
}
