import Link from "next/link";
import { Search } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { CampoTexto } from "@/components/ui/campo-texto";
import type { NumeroPipeline, Regiao } from "@/lib/dados/tipos";
import { CamposFiltroPipeline, type ValoresFiltro } from "./campos-filtro";
import { FiltrosPipelineCelular } from "./filtros-pipeline-celular";

/**
 * Filtros do pipeline (P15 item 1): região, classificação e semanas de
 * gestação, além da busca por nome ou telefone. Formulário GET simples, sem
 * JavaScript: o link fica compartilhável e volta a funcionar mesmo se a
 * tela ainda não carregou o cliente.
 *
 * Abaixo de 600 px (DESIGN.md, 11.5 "Filtro recolhido"): só a busca e um
 * botão "Filtros" com a contagem dos ligados, que abre a folha inferior.
 * A lista de famílias começa na primeira dobra.
 */
export function FiltrosPipeline({
  pipeline,
  regioes,
  valores,
}: {
  pipeline: NumeroPipeline;
  regioes: Regiao[];
  valores: ValoresFiltro;
}) {
  return (
    <>
      <form
        method="get"
        action="/pipeline"
        className="border-linha tablet:flex hidden flex-col gap-4 border-b pb-4"
      >
        <input type="hidden" name="pipeline" value={pipeline} />
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <CampoTexto
            rotulo="Buscar"
            name="busca"
            defaultValue={valores.busca}
            placeholder="Nome ou telefone"
            containerClassName="min-w-48 flex-1"
            acessorio={
              <Search
                aria-hidden="true"
                className="text-texto-2 mr-3 size-4 shrink-0"
              />
            }
          />
          <CamposFiltroPipeline regioes={regioes} valores={valores} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Botao type="submit" variante="secundario" tamanho="compacto">
            Filtrar
          </Botao>
          <Link
            href={`/pipeline?pipeline=${pipeline}`}
            className="text-apoio text-texto-2 min-h-toque inline-flex items-center underline underline-offset-2 hover:no-underline"
          >
            Limpar filtros
          </Link>
        </div>
      </form>
      <FiltrosPipelineCelular
        pipeline={pipeline}
        regioes={regioes}
        valores={valores}
      />
    </>
  );
}
