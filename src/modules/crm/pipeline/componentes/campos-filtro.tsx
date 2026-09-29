import { CampoTexto } from "@/components/ui/campo-texto";
import type { ClassificacaoLead, Regiao } from "@/lib/dados/tipos";
import { CampoSelecao } from "./campo-selecao";

export interface ValoresFiltro {
  busca?: string;
  regiaoId?: string;
  classificacao?: string;
  minhas?: boolean;
  semanasMin?: string;
  semanasMax?: string;
}

const OPCOES_CLASSIFICACAO: { valor: ClassificacaoLead; rotulo: string }[] = [
  { valor: "quente", rotulo: "Quente" },
  { valor: "morno", rotulo: "Morno" },
  { valor: "frio", rotulo: "Frio" },
];

/** Quantos filtros estão ligados (a busca fica de fora: ela é sempre visível). */
export function contarFiltrosLigados(valores: ValoresFiltro): number {
  return [
    valores.regiaoId,
    valores.classificacao,
    valores.minhas ? "1" : undefined,
    valores.semanasMin || valores.semanasMax,
  ].filter(Boolean).length;
}

/**
 * Os campos de filtro além da busca, os mesmos no formulário do computador
 * e na folha do celular.
 */
export function CamposFiltroPipeline({
  regioes,
  valores,
}: {
  regioes: Regiao[];
  valores: ValoresFiltro;
}) {
  return (
    <>
      <CampoSelecao
        rotulo="Região"
        name="regiaoId"
        opcaoVazia="Todas as regiões"
        defaultValue={valores.regiaoId}
        opcoes={regioes.map((r) => ({ valor: r.id, rotulo: r.nome }))}
        className="min-w-40"
      />
      <CampoSelecao
        rotulo="Classificação"
        name="classificacao"
        opcaoVazia="Quente, morno e frio"
        defaultValue={valores.classificacao}
        opcoes={OPCOES_CLASSIFICACAO.map((o) => ({
          valor: o.valor,
          rotulo: o.rotulo,
        }))}
        className="min-w-40"
      />
      <div className="flex gap-3">
        <CampoTexto
          rotulo="Semanas de"
          name="semanasMin"
          type="number"
          inputMode="numeric"
          defaultValue={valores.semanasMin}
          containerClassName="w-24"
        />
        <CampoTexto
          rotulo="até"
          name="semanasMax"
          type="number"
          inputMode="numeric"
          defaultValue={valores.semanasMax}
          containerClassName="w-24"
        />
      </div>
      <label className="border-borda-campo bg-superficie text-apoio text-texto min-h-toque rounded-pilula inline-flex w-fit items-center gap-2 border-[1.5px] px-4 font-medium">
        <input
          type="checkbox"
          name="minhas"
          value="1"
          defaultChecked={valores.minhas}
          className="accent-marinho size-4"
        />
        Só as minhas famílias
      </label>
    </>
  );
}
