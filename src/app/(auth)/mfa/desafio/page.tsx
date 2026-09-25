import type { Metadata } from "next";
import { LogOut } from "lucide-react";
import { exigirSessao, obterAutenticacao } from "@/lib/auth/sessao";
import { FormularioDesafio } from "../../_componentes/formularios";
import { proximoDaBusca, type ParametrosBusca } from "../../_componentes/parametros";

export const metadata: Metadata = { title: "Confirmar acesso · Kraamzorg OS" };

/**
 * Desafio do MFA (C7, segunda etapa; PRD 13 e 21.2). Quem tem papel com
 * dado assistencial ou financeiro só passa daqui com a sessão em AAL2.
 */
export default async function PaginaDesafioMfa({ searchParams }: { searchParams: ParametrosBusca }) {
  await exigirSessao();
  const proximo = proximoDaBusca(await searchParams);
  const ajuda = obterAutenticacao().ajudaDesafioMfa();

  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="font-titulo text-display text-texto font-normal">Confirme que é você</h1>
        <p className="text-corpo text-texto">
          Digite o código de 6 dígitos do seu aplicativo autenticador.
        </p>
        {ajuda ? <p className="text-apoio text-texto-2">{ajuda}</p> : null}
      </div>
      <FormularioDesafio proximo={proximo} />
      <form action="/sair" method="post">
        <button
          type="submit"
          className="rounded-pilula text-apoio text-texto hover:bg-marinho-08 min-h-toque -ml-3 inline-flex items-center gap-2 px-3 font-semibold underline decoration-1 underline-offset-4"
        >
          <LogOut aria-hidden="true" className="size-5" strokeWidth={1.75} />
          Entrar com outro e-mail
        </button>
      </form>
    </>
  );
}
