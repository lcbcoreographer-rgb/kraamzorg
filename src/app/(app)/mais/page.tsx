import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, LogOut } from "lucide-react";
import { CabecalhoTela } from "@/components/shell/cabecalho-tela";
import { IconeNavegacao } from "@/components/shell/icones-navegacao";
import { descreverPapeis } from "@/lib/auth/papeis";
import { exigirSessao } from "@/lib/auth/sessao";
import { gruposDoMais } from "@/lib/navegacao";

export const metadata: Metadata = { title: "Mais · Kraamzorg OS" };

/**
 * Aba "Mais" do celular (PRD 20.4; protótipo comercial.html): tudo o que a
 * barra lateral do papel tem e não coube nas abas, nos mesmos grupos, e o
 * botão de sair. No computador a barra lateral já mostra tudo.
 */
export default async function PaginaMais() {
  const sessao = await exigirSessao();
  const grupos = gruposDoMais(sessao.papeis);

  return (
    <>
      <CabecalhoTela titulo="Mais" />
      <div className="flex flex-col gap-8 pt-6">
        <p className="text-apoio text-texto-2">
          <span className="text-texto font-semibold">{sessao.nome}</span>
          <br />
          {descreverPapeis(sessao.papeis)}
        </p>

        {grupos.map((grupo) => (
          <section
            key={grupo.titulo}
            aria-labelledby={`mais-${grupo.titulo}`}
            className="flex flex-col gap-3"
          >
            <h2
              id={`mais-${grupo.titulo}`}
              className="font-titulo text-2 text-texto font-medium"
            >
              {grupo.titulo}
            </h2>
            <ul className="flex flex-col gap-2">
              {grupo.itens.map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.caminho}
                    className="rounded-3 bg-superficie shadow-1 hover:shadow-2 ease-estado min-h-toque-campo text-corpo text-texto flex items-center gap-3 px-5 py-3 font-semibold no-underline transition-shadow duration-140 [&>svg]:size-5"
                  >
                    <IconeNavegacao nome={item.icone} />
                    <span>{item.rotulo}</span>
                    <ChevronRight
                      aria-hidden="true"
                      className="text-texto-2 ml-auto"
                      strokeWidth={1.75}
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <form action="/sair" method="post">
          <button
            type="submit"
            className="rounded-pilula border-borda-campo bg-superficie text-corpo text-texto hover:bg-marinho-08 inline-flex min-h-12 items-center gap-2 border-[1.5px] px-6 font-semibold"
          >
            <LogOut aria-hidden="true" className="size-5" strokeWidth={1.75} />
            Sair
          </button>
        </form>
      </div>
    </>
  );
}
