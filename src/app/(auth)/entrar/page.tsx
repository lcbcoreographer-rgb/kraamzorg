import type { Metadata } from "next";
import { Lock, UserRound } from "lucide-react";
import { FaixaAlerta } from "@/components/ui/faixa-alerta";
import { descreverPapeis } from "@/lib/auth/papeis";
import { obterAutenticacao } from "@/lib/auth/sessao";
import { entrarPorSeletor } from "../acoes";
import { FormularioEntrar } from "../_componentes/formularios";
import {
  parametro,
  proximoDaBusca,
  type ParametrosBusca,
} from "../_componentes/parametros";
import { AVISO_ENTRAR, TEXTO_LGPD } from "../mensagens";

export const metadata: Metadata = { title: "Entrar · Kraamzorg OS" };

/**
 * C7 · Entrar (telas.md; protótipo entrar.html). E-mail e senha na real;
 * no modo demonstração, só em desenvolvimento, um seletor das pessoas
 * fictícias do seed. A tela pergunta a forma de entrada à autenticação e
 * não sabe qual implementação está rodando.
 */
export default async function PaginaEntrar({
  searchParams,
}: {
  searchParams: ParametrosBusca;
}) {
  const busca = await searchParams;
  const proximo = proximoDaBusca(busca);
  const aviso = AVISO_ENTRAR[parametro(busca, "aviso") ?? ""];
  const forma = obterAutenticacao().formaDeEntrada();

  return (
    <>
      <h1 className="font-titulo text-display text-texto font-normal">
        Entrar
      </h1>
      {aviso ? <FaixaAlerta variante="info" titulo={aviso} /> : null}

      {forma.tipo === "senha" ? (
        <FormularioEntrar proximo={proximo} />
      ) : (
        <section
          aria-labelledby="titulo-seletor"
          className="flex flex-col gap-4"
        >
          <FaixaAlerta variante="info" titulo="Modo demonstração">
            Dados fictícios, só neste computador. Escolha com quem entrar; nada
            aqui toca o banco de verdade.
          </FaixaAlerta>
          <h2
            id="titulo-seletor"
            className="font-titulo text-2 text-texto font-medium"
          >
            Entrar como
          </h2>
          <ul className="flex flex-col gap-2">
            {forma.opcoes.map((opcao) => (
              <li key={opcao.usuarioId}>
                <form action={entrarPorSeletor}>
                  <input
                    type="hidden"
                    name="usuarioId"
                    value={opcao.usuarioId}
                  />
                  {proximo ? (
                    <input type="hidden" name="proximo" value={proximo} />
                  ) : null}
                  <button
                    type="submit"
                    className="rounded-3 bg-superficie shadow-1 hover:shadow-2 ease-estado min-h-toque-campo flex w-full items-center gap-3 px-5 py-3 text-left transition-shadow duration-140"
                  >
                    <UserRound
                      aria-hidden="true"
                      className="text-texto-2 size-5 shrink-0"
                      strokeWidth={1.75}
                    />
                    <span className="flex flex-col">
                      <span className="text-corpo text-texto font-semibold">
                        {descreverPapeis(opcao.papeis)}
                      </span>
                      <span className="text-apoio text-texto-2">
                        {opcao.nome}
                      </span>
                    </span>
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-apoio text-texto-2 flex items-start gap-2">
        <Lock
          aria-hidden="true"
          className="mt-0.5 size-4 shrink-0"
          strokeWidth={1.75}
        />
        <span>{TEXTO_LGPD}</span>
      </p>
    </>
  );
}
