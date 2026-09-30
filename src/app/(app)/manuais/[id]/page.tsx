import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, History, Users } from "lucide-react";
import { BarraProgresso } from "@/components/ui/barra-progresso";
import { TileIcone } from "@/components/ui/tile-icone";
import { notFound } from "next/navigation";
import { Selo } from "@/components/ui/selo";
import { exigirSessao } from "@/lib/auth/sessao";
import { obterRepositorios } from "@/lib/dados/fabrica";
import type { DetalheManual, LeituraManual } from "@/lib/dados/tipos-relacao";
import { formatarData } from "@/lib/formatacao";
import { ConfirmarLeitura } from "@/modules/manuais/componentes/confirmar-leitura";
import { FormularioManual } from "@/modules/manuais/componentes/form-manual";

export const metadata: Metadata = { title: "Manual · Kraamzorg OS" };

/** Um manual ou protocolo na versão vigente, com a confirmação de leitura (P51 item 2). */
export default async function PaginaManual({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const usuario = await exigirSessao(`/manuais/${id}`);
  const gestao = usuario.papeis.some(
    (p) => p === "coordenacao" || p === "diretoria",
  );

  let manual: DetalheManual | null = null;
  let leituras: LeituraManual | null = null;
  try {
    const { relacao } = await obterRepositorios();
    manual = await relacao.manuais.obter(id);
    if (manual && gestao) leituras = await relacao.manuais.leituras(id);
  } catch {
    manual = null;
  }
  if (!manual) notFound();

  return (
    <div className="flex flex-col gap-8 pt-2">
      <div className="flex flex-col gap-2">
        <Link
          href="/manuais"
          className="text-apoio text-texto-2 hover:text-texto min-h-toque -ml-1 inline-flex items-center gap-1.5 self-start font-medium no-underline"
        >
          <ArrowLeft aria-hidden="true" className="size-4" strokeWidth={1.75} />
          Voltar para os manuais
        </Link>
        <h1 className="font-titulo text-display lg:text-display-lg text-texto font-normal">
          {manual.titulo}
        </h1>
        <p className="text-apoio text-texto-2">
          {manual.categoria === "protocolo" ? "Protocolo" : "Manual"}, versão{" "}
          {manual.versao}, publicada em {formatarData(manual.publicadaEm)}.
        </p>
      </div>

      {/* A leitura numa folha branca de medida confortável, com a
          confirmação logo abaixo; no computador, as versões e quem já
          confirmou ficam na coluna da direita. */}
      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[62fr_38fr]">
        <div className="flex min-w-0 flex-col gap-4">
          <article className="rounded-3 bg-superficie shadow-1 p-6 lg:p-8">
            <div className="text-corpo text-texto max-w-[68ch] leading-relaxed whitespace-pre-wrap">
              {manual.conteudo}
            </div>
          </article>

          <ConfirmarLeitura versaoId={manual.versaoId} jaLido={manual.lido} />
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <section
            aria-labelledby="historico"
            className="rounded-3 bg-lavanda-clara flex flex-col gap-3 p-5"
          >
            <h2
              id="historico"
              className="font-titulo text-2 text-texto flex items-center gap-3 font-medium"
            >
              <TileIcone tom="lavanda" forma="quadrado" tamanho="p">
                <History />
              </TileIcone>
              Versões
            </h2>
            <ul className="flex flex-col gap-2">
              {manual.historico.map((h) => (
                <li
                  key={h.versao}
                  className="rounded-2 bg-superficie text-corpo text-texto px-4 py-3"
                >
                  Versão {h.versao}, {formatarData(h.publicadaEm)}
                  {h.resumoMudanca ? `: ${h.resumoMudanca}` : ""}
                </li>
              ))}
            </ul>
          </section>

          {leituras ? (
            <section
              aria-labelledby="leituras"
              className="rounded-3 bg-argila-clara flex flex-col gap-3 p-5"
            >
              <h2
                id="leituras"
                className="font-titulo text-2 text-texto flex items-center gap-3 font-medium"
              >
                <TileIcone tom="argila" forma="quadrado" tamanho="p">
                  <Users />
                </TileIcone>
                Quem confirmou a versão {leituras.versao}
              </h2>
              {leituras.pessoas.length > 0 ? (
                <BarraProgresso
                  valor={leituras.pessoas.filter((p) => p.confirmou).length}
                  total={leituras.pessoas.length}
                  texto={`${leituras.pessoas.filter((p) => p.confirmou).length} de ${leituras.pessoas.length} confirmaram`}
                  textoCompleta="Todos confirmaram esta versão"
                />
              ) : null}
              {leituras.pessoas.length === 0 ? (
                <p className="text-corpo text-texto-2">
                  Nenhuma função marcada para ler este manual.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {leituras.pessoas.map((p) => (
                    <li
                      key={p.usuarioId}
                      className="rounded-2 bg-superficie text-corpo text-texto flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                    >
                      {p.nome}
                      <Selo variante={p.confirmou ? "sucesso" : "aviso"}>
                        {p.confirmou && p.confirmadaEm
                          ? `Confirmou em ${formatarData(p.confirmadaEm)}`
                          : "Ainda não confirmou"}
                      </Selo>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : null}
        </div>
      </div>

      {gestao ? <FormularioManual manual={manual} /> : null}
    </div>
  );
}
