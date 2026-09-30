import type { Metadata } from "next";
import Link from "next/link";
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
          className="text-apoio text-texto-2 underline underline-offset-4"
        >
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

      <article className="rounded-3 bg-superficie shadow-1 p-5">
        <div className="text-corpo text-texto max-w-[72ch] whitespace-pre-wrap">
          {manual.conteudo}
        </div>
      </article>

      <ConfirmarLeitura versaoId={manual.versaoId} jaLido={manual.lido} />

      <section aria-labelledby="historico" className="flex flex-col gap-2">
        <h2
          id="historico"
          className="font-titulo text-1 text-texto font-normal"
        >
          Versões
        </h2>
        <ul className="flex flex-col gap-1">
          {manual.historico.map((h) => (
            <li key={h.versao} className="text-corpo text-texto">
              Versão {h.versao}, {formatarData(h.publicadaEm)}
              {h.resumoMudanca ? `: ${h.resumoMudanca}` : ""}
            </li>
          ))}
        </ul>
      </section>

      {leituras ? (
        <section aria-labelledby="leituras" className="flex flex-col gap-2">
          <h2
            id="leituras"
            className="font-titulo text-1 text-texto font-normal"
          >
            Quem confirmou a versão {leituras.versao}
          </h2>
          {leituras.pessoas.length === 0 ? (
            <p className="text-corpo text-texto-2">
              Nenhuma função marcada para ler este manual.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {leituras.pessoas.map((p) => (
                <li
                  key={p.usuarioId}
                  className="text-corpo text-texto flex flex-wrap items-center gap-3"
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

      {gestao ? <FormularioManual manual={manual} /> : null}
    </div>
  );
}
