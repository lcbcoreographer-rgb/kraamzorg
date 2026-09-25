import type { Metadata } from "next";
import Link from "next/link";
import { Users } from "lucide-react";
import { CabecalhoTela } from "@/components/shell/cabecalho-tela";
import { Botao } from "@/components/ui/botao";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { exigirSessao } from "@/lib/auth/sessao";
import { obterRepositorios } from "@/lib/dados/fabrica";
import type { ClassificacaoLead, NumeroPipeline } from "@/lib/dados/tipos";
import { FiltrosPipeline } from "@/modules/crm/pipeline/componentes/filtros-pipeline";
import { FormularioLead } from "@/modules/crm/pipeline/componentes/formulario-lead";
import { QuadroPipeline } from "@/modules/crm/pipeline/componentes/quadro-pipeline";
import { listarPipelineTela } from "@/modules/crm/pipeline/dados";
import type {
  CartaoPipelineTela,
  FiltroPipelineTela,
} from "@/modules/crm/pipeline/tipos";

export const metadata: Metadata = { title: "Pipeline · Kraamzorg OS" };

type Pesquisa = Record<string, string | string[] | undefined>;

function texto(pesquisa: Pesquisa, chave: string): string | undefined {
  const valor = pesquisa[chave];
  const primeiro = Array.isArray(valor) ? valor[0] : valor;
  return primeiro?.trim() || undefined;
}

function numero(pesquisa: Pesquisa, chave: string): number | undefined {
  const bruto = texto(pesquisa, chave);
  if (!bruto) return undefined;
  const valor = Number(bruto);
  return Number.isFinite(valor) ? valor : undefined;
}

/**
 * Pipeline comercial (P15): lista agrupada por estágio no celular, kanban
 * no computador (protótipo `comercial-pipeline.html`). Pipeline 1 é
 * "Entrada e qualificação"; pipeline 2, "Venda e pré-atendimento" (PRD 7.1
 * e 7.2). A rota é registrada em `src/lib/navegacao` pela casca (P10); esta
 * página só troca o conteúdo, dentro de `src/app/(app)/pipeline`.
 */
export default async function PaginaPipeline({
  searchParams,
}: {
  searchParams: Promise<Pesquisa>;
}) {
  const sessao = await exigirSessao("/pipeline");
  const pesquisa = await searchParams;
  const pipeline: NumeroPipeline = texto(pesquisa, "pipeline") === "2" ? 2 : 1;
  const podeCadastrar =
    sessao.papeis.includes("comercial") || sessao.papeis.includes("diretoria");

  const filtro: FiltroPipelineTela = {
    pipeline,
    regiaoId: texto(pesquisa, "regiaoId"),
    classificacao: texto(pesquisa, "classificacao") as
      ClassificacaoLead | undefined,
    busca: texto(pesquisa, "busca"),
    minhas: texto(pesquisa, "minhas") === "1",
    semanasMin: numero(pesquisa, "semanasMin"),
    semanasMax: numero(pesquisa, "semanasMax"),
  };

  let cartoes: CartaoPipelineTela[] = [];
  let regioes: Awaited<
    ReturnType<
      Awaited<
        ReturnType<typeof obterRepositorios>
      >["configuracoes"]["listarRegioes"]
    >
  > = [];
  let falhou = false;
  try {
    const { configuracoes } = await obterRepositorios();
    [cartoes, regioes] = await Promise.all([
      listarPipelineTela(filtro),
      configuracoes.listarRegioes(),
    ]);
  } catch {
    falhou = true;
  }

  return (
    <>
      <CabecalhoTela
        titulo="Pipeline"
        lateral={
          <>
            <Botao
              asChild
              variante="fantasma"
              tamanho="compacto"
              iconeEsquerda={<Users aria-hidden="true" className="size-4" />}
            >
              <Link href="/pipeline/duplicatas">Duplicatas</Link>
            </Botao>
            {podeCadastrar && pipeline === 1 ? <FormularioLead /> : null}
          </>
        }
      />

      <div
        role="tablist"
        aria-label="Pipelines"
        className="border-linha mt-4 flex gap-1 border-b"
      >
        {(
          [
            { valor: 1, rotulo: "Entrada e qualificação" },
            { valor: 2, rotulo: "Venda e pré-atendimento" },
          ] as const
        ).map((aba) => (
          <Link
            key={aba.valor}
            href={`/pipeline?pipeline=${aba.valor}`}
            role="tab"
            aria-selected={pipeline === aba.valor}
            className={`min-h-toque rounded-t-2 text-apoio -mb-px inline-flex items-center border-b-2 px-4 font-medium ${
              pipeline === aba.valor
                ? "border-marinho text-texto"
                : "text-texto-2 hover:bg-marinho-08 border-transparent"
            }`}
          >
            {aba.rotulo}
          </Link>
        ))}
      </div>

      <div className="pt-4">
        <FiltrosPipeline
          pipeline={pipeline}
          regioes={regioes}
          valores={{
            busca: filtro.busca,
            regiaoId: filtro.regiaoId,
            classificacao: filtro.classificacao,
            minhas: filtro.minhas,
            semanasMin: texto(pesquisa, "semanasMin"),
            semanasMax: texto(pesquisa, "semanasMax"),
          }}
        />
      </div>

      <div className="pt-2">
        {falhou ? (
          <FaixaAlerta
            variante="imediato"
            titulo="Não foi possível carregar o pipeline agora"
          >
            Confira a conexão e recarregue a página. Se continuar, avise a
            equipe técnica.
          </FaixaAlerta>
        ) : (
          <QuadroPipeline
            pipeline={pipeline}
            cartoes={cartoes}
            papeis={sessao.papeis}
          />
        )}
      </div>
    </>
  );
}
