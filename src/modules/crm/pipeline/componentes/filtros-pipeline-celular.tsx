"use client";

import * as React from "react";
import Link from "next/link";
import { Search, SlidersHorizontal } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { CampoTexto } from "@/components/ui/campo-texto";
import {
  Dialogo,
  DialogoConteudo,
  DialogoGatilho,
  DialogoRodape,
} from "@/components/ui/dialogo";
import type { NumeroPipeline, Regiao } from "@/lib/dados/tipos";
import {
  CamposFiltroPipeline,
  contarFiltrosLigados,
  type ValoresFiltro,
} from "./campos-filtro";

/**
 * Filtros do pipeline no celular (abaixo de 600 px; DESIGN.md, 11.5): a
 * busca continua visível e o resto fica atrás de "Filtros", com a contagem
 * dos ligados, numa folha inferior. Dois formulários GET: o da busca leva
 * os filtros ligados em campos ocultos, e o da folha leva a busca, para um
 * não apagar o outro.
 */
export function FiltrosPipelineCelular({
  pipeline,
  regioes,
  valores,
}: {
  pipeline: NumeroPipeline;
  regioes: Regiao[];
  valores: ValoresFiltro;
}) {
  const [aberto, definirAberto] = React.useState(false);
  const ligados = contarFiltrosLigados(valores);

  const ocultosDosFiltros = (
    <>
      <input type="hidden" name="pipeline" value={pipeline} />
      {valores.regiaoId ? (
        <input type="hidden" name="regiaoId" value={valores.regiaoId} />
      ) : null}
      {valores.classificacao ? (
        <input
          type="hidden"
          name="classificacao"
          value={valores.classificacao}
        />
      ) : null}
      {valores.minhas ? <input type="hidden" name="minhas" value="1" /> : null}
      {valores.semanasMin ? (
        <input type="hidden" name="semanasMin" value={valores.semanasMin} />
      ) : null}
      {valores.semanasMax ? (
        <input type="hidden" name="semanasMax" value={valores.semanasMax} />
      ) : null}
    </>
  );

  return (
    <div className="tablet:hidden flex items-end gap-2">
      <form method="get" action="/pipeline" className="min-w-0 flex-1">
        {ocultosDosFiltros}
        <CampoTexto
          rotulo="Buscar"
          name="busca"
          type="search"
          defaultValue={valores.busca}
          placeholder="Nome ou telefone"
          acessorio={
            <Search
              aria-hidden="true"
              className="text-texto-2 mr-3 size-4 shrink-0"
            />
          }
        />
      </form>
      <Dialogo open={aberto} onOpenChange={definirAberto}>
        <DialogoGatilho asChild>
          <Botao
            type="button"
            variante="secundario"
            className="min-h-toque-campo px-4"
            aria-label={
              ligados > 0
                ? `Filtros, ${ligados} ${ligados === 1 ? "ligado" : "ligados"}`
                : "Filtros"
            }
            iconeEsquerda={
              <SlidersHorizontal
                aria-hidden="true"
                className="size-4"
                strokeWidth={1.75}
              />
            }
          >
            Filtros
            {ligados > 0 ? (
              <span className="rounded-pilula bg-areia text-mini inline-flex min-w-6 items-center justify-center px-1.5 font-mono tabular-nums">
                {ligados}
              </span>
            ) : null}
          </Botao>
        </DialogoGatilho>
        <DialogoConteudo titulo="Filtrar o pipeline" rotuloFechar="Fechar">
          <form
            method="get"
            action="/pipeline"
            className="mt-2 flex flex-col gap-4"
          >
            <input type="hidden" name="pipeline" value={pipeline} />
            {valores.busca ? (
              <input type="hidden" name="busca" value={valores.busca} />
            ) : null}
            <CamposFiltroPipeline regioes={regioes} valores={valores} />
            <DialogoRodape>
              <Link
                href={`/pipeline?pipeline=${pipeline}`}
                className="text-apoio text-texto-2 min-h-toque inline-flex items-center underline underline-offset-2 hover:no-underline"
              >
                Limpar filtros
              </Link>
              <Botao type="submit">Mostrar famílias</Botao>
            </DialogoRodape>
          </form>
        </DialogoConteudo>
      </Dialogo>
    </div>
  );
}
