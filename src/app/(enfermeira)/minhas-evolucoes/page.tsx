import type { Metadata } from "next";
import { CabecalhoTela } from "@/components/shell/cabecalho-tela";
import { exigirSessao } from "@/lib/auth/sessao";
import {
  ConteudoListaEvolucoes,
  situacaoDaBusca,
} from "@/modules/assistencial/evolucao/componentes/conteudo-lista";

export const metadata: Metadata = { title: "Evoluções · Kraamzorg OS" };

/**
 * Evoluções da enfermeira (P41): só as dos acompanhamentos em que ela
 * atende, lidas por `api.evolucoes`. Ela preenche o que o checklist não
 * registra e manda para a revisão da coordenação.
 */
export default async function PaginaMinhasEvolucoes({
  searchParams,
}: {
  searchParams: Promise<{ situacao?: string }>;
}) {
  const { situacao } = await searchParams;
  await exigirSessao("/minhas-evolucoes");
  return (
    <>
      <CabecalhoTela
        titulo="Evoluções"
        subtitulo="O documento que sai para os médicos depois do último dia de cada família."
      />
      <div className="pt-6">
        <ConteudoListaEvolucoes
          filtro={situacaoDaBusca(situacao)}
          base="/minhas-evolucoes"
          baseFamilia="/minhas-familias"
        />
      </div>
    </>
  );
}
