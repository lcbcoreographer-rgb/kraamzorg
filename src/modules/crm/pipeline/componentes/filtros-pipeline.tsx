import Link from "next/link";
import { Search } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { CampoTexto } from "@/components/ui/campo-texto";
import type {
  ClassificacaoLead,
  NumeroPipeline,
  Regiao,
} from "@/lib/dados/tipos";
import { CampoSelecao } from "./campo-selecao";

const OPCOES_CLASSIFICACAO: { valor: ClassificacaoLead; rotulo: string }[] = [
  { valor: "quente", rotulo: "Quente" },
  { valor: "morno", rotulo: "Morno" },
  { valor: "frio", rotulo: "Frio" },
];

/**
 * Filtros do pipeline (P15 item 1): região, classificação e semanas de
 * gestação, além da busca por nome ou telefone. Formulário GET simples, sem
 * JavaScript: o link fica compartilhável e volta a funcionar mesmo se a
 * tela ainda não carregou o cliente.
 */
export function FiltrosPipeline({
  pipeline,
  regioes,
  valores,
}: {
  pipeline: NumeroPipeline;
  regioes: Regiao[];
  valores: {
    busca?: string;
    regiaoId?: string;
    classificacao?: string;
    minhas?: boolean;
    semanasMin?: string;
    semanasMax?: string;
  };
}) {
  return (
    <form
      method="get"
      action="/pipeline"
      className="border-linha flex flex-col gap-4 border-b pb-4"
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
        <CampoTexto
          rotulo="Semanas de"
          name="semanasMin"
          type="number"
          defaultValue={valores.semanasMin}
          containerClassName="w-24"
        />
        <CampoTexto
          rotulo="até"
          name="semanasMax"
          type="number"
          defaultValue={valores.semanasMax}
          containerClassName="w-24"
        />
        <label className="border-borda-campo bg-superficie text-apoio text-texto min-h-toque rounded-pilula inline-flex items-center gap-2 border-[1.5px] px-4 font-medium">
          <input
            type="checkbox"
            name="minhas"
            value="1"
            defaultChecked={valores.minhas}
            className="accent-marinho size-4"
          />
          Só as minhas famílias
        </label>
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
  );
}
