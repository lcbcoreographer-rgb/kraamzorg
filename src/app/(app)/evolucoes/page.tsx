import type { Metadata } from "next";
import { CabecalhoTela } from "@/components/shell/cabecalho-tela";
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
    <>
      <CabecalhoTela
        titulo="Evoluções"
        subtitulo="O documento que sai para os médicos depois do último dia de cada família. A coordenação revisa, aprova e envia."
      />
      <div className="pt-6">
        <ConteudoListaEvolucoes
          filtro={situacaoDaBusca(situacao)}
          base="/evolucoes"
          baseFamilia="/familias"
        />
      </div>
    </>
  );
}
