import type { Papel } from "@/lib/auth/papeis";
import { FolhaLupa } from "@/components/ilustracoes";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import type { NumeroPipeline } from "@/lib/dados/tipos";
import { ORDEM_P1, ORDEM_P2, rotuloEstagio } from "../estagios";
import type { CartaoPipelineTela } from "../tipos";
import { CartaoOportunidadePipeline } from "./cartao-oportunidade";

/**
 * Quadro do pipeline (P15 item 1): lista agrupada por estágio no celular,
 * kanban por colunas no computador (protótipo `comercial-pipeline.html`).
 * Direção "Colo" (DESIGN.md, 2.5): cada coluna é um bloco `areia-clara`
 * com a contagem numa pílula branca; os cartões são brancos, o trabalho.
 * As duas apresentações usam os mesmos grupos; só o CSS muda (`lg:`),
 * então não há duplicação de dado nem de lógica de agrupamento.
 */
export function QuadroPipeline({
  pipeline,
  cartoes,
  papeis,
}: {
  pipeline: NumeroPipeline;
  cartoes: CartaoPipelineTela[];
  papeis: readonly Papel[];
}) {
  const ordem = pipeline === 1 ? ORDEM_P1 : ORDEM_P2;
  const grupos = ordem.map((estagio) => ({
    estagio,
    rotulo: rotuloEstagio(pipeline, estagio),
    cartoes: cartoes.filter((c) =>
      pipeline === 1 ? c.estagioP1 === estagio : c.estagioP2 === estagio,
    ),
  }));

  if (cartoes.length === 0) {
    return (
      <EstadoVazio
        nivelTitulo="h2"
        ilustracao={<FolhaLupa tamanho={112} />}
        titulo="Nenhuma família com esses filtros"
        texto="Troque os filtros ou a busca. Se a lista inteira está vazia, o pipeline ainda não tem nenhuma família neste estágio."
      />
    );
  }

  return (
    <>
      {/* Pílulas de atalho (celular): pulam para o grupo no scroll. */}
      <nav
        aria-label={`Estágios do pipeline ${pipeline === 1 ? "de entrada" : "de venda"}`}
        className="-mx-4 flex gap-2 overflow-x-auto px-4 py-1 lg:hidden"
      >
        {grupos
          .filter((g) => g.cartoes.length > 0)
          .map((grupo) => (
            <a
              key={grupo.estagio}
              href={`#grupo-${grupo.estagio}`}
              className="bg-superficie shadow-1 text-texto min-h-toque rounded-pilula text-apoio hover:bg-areia-clara inline-flex flex-none items-center gap-2 py-1 pr-1.5 pl-4 font-semibold whitespace-nowrap"
            >
              {grupo.rotulo}
              <span className="rounded-pilula bg-areia text-mini inline-flex min-h-8 min-w-8 items-center justify-center px-2 font-mono font-medium">
                {grupo.cartoes.length}
              </span>
            </a>
          ))}
      </nav>

      {/* Celular: lista agrupada por estágio. */}
      <div className="flex flex-col gap-8 pt-2 lg:hidden">
        {grupos
          .filter((g) => g.cartoes.length > 0)
          .map((grupo) => (
            <section
              key={grupo.estagio}
              id={`grupo-${grupo.estagio}`}
              className="scroll-mt-20"
              aria-labelledby={`titulo-${grupo.estagio}`}
            >
              <div className="mb-3 flex items-center gap-2">
                <h2
                  id={`titulo-${grupo.estagio}`}
                  className="font-titulo text-2 font-medium"
                >
                  {grupo.rotulo}
                </h2>
                <span className="rounded-pilula bg-areia text-apoio inline-flex min-h-7 min-w-7 items-center justify-center px-2 font-mono">
                  {grupo.cartoes.length}
                </span>
              </div>
              <div className="flex flex-col gap-3">
                {grupo.cartoes.map((cartao) => (
                  <CartaoOportunidadePipeline
                    key={cartao.oportunidadeId}
                    cartao={cartao}
                    pipeline={pipeline}
                    papeis={papeis}
                  />
                ))}
              </div>
            </section>
          ))}
      </div>

      {/* Computador: quadro em colunas. */}
      <div className="hidden gap-3 overflow-x-auto pt-2 pb-2 lg:grid lg:auto-cols-[minmax(280px,1fr)] lg:grid-flow-col lg:items-start">
        {grupos.map((grupo) => (
          <section
            key={grupo.estagio}
            className="bg-areia-clara rounded-3 flex min-h-40 flex-col gap-3 p-3"
            aria-labelledby={`titulo-computador-${grupo.estagio}`}
          >
            <div className="flex min-h-10 items-center justify-between gap-2 pl-2">
              <h2
                id={`titulo-computador-${grupo.estagio}`}
                className="font-titulo text-3 font-medium whitespace-nowrap"
              >
                {grupo.rotulo}
              </h2>
              <span className="rounded-pilula bg-superficie text-apoio inline-flex min-h-8 min-w-8 items-center justify-center px-2 font-mono font-medium">
                {grupo.cartoes.length}
              </span>
            </div>
            {grupo.cartoes.length === 0 ? (
              <p className="text-apoio text-texto-2 px-2 pb-2">
                Nenhuma família neste estágio agora.
              </p>
            ) : null}
            <div className="flex flex-col gap-3">
              {grupo.cartoes.map((cartao) => (
                <CartaoOportunidadePipeline
                  key={cartao.oportunidadeId}
                  cartao={cartao}
                  pipeline={pipeline}
                  papeis={papeis}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
