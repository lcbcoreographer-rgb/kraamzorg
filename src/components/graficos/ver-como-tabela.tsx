import * as React from "react";
import { ChevronDown } from "lucide-react";
import {
  TabelaLista,
  type ColunaTabela,
  type LinhaTabela,
} from "@/components/ui/tabela-lista";

/**
 * "Ver como tabela" (skill dataviz, acessibilidade): todo gráfico tem a mesma
 * informação em tabela. Abre e fecha sem JavaScript (`<details>`), e a tabela
 * vira lista de cartões no celular, como as outras.
 */
export function VerComoTabela({
  rotulo,
  colunas,
  linhas,
  aberta,
}: {
  rotulo: string;
  colunas: ColunaTabela[];
  linhas: LinhaTabela[];
  aberta?: boolean;
}) {
  return (
    <details open={aberta} className="group mt-3">
      <summary className="text-apoio text-texto min-h-toque inline-flex cursor-pointer list-none items-center gap-2 font-semibold underline decoration-1 underline-offset-4 [&::-webkit-details-marker]:hidden">
        <ChevronDown
          aria-hidden="true"
          strokeWidth={1.75}
          className="size-4 transition-transform group-open:rotate-180"
        />
        Ver como tabela
      </summary>
      <div
        className="mt-2 overflow-x-auto focus-visible:outline-2 focus-visible:outline-offset-2"
        role="region"
        aria-label={rotulo}
        tabIndex={0}
      >
        <TabelaLista rotulo={rotulo} colunas={colunas} linhas={linhas} />
      </div>
    </details>
  );
}
