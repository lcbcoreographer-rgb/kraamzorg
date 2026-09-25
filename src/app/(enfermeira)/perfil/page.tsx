import type { Metadata } from "next";
import { LogOut } from "lucide-react";
import { CabecalhoTela } from "@/components/shell/cabecalho-tela";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { exigirSessao } from "@/lib/auth/sessao";

export const metadata: Metadata = { title: "Perfil · Kraamzorg OS" };

/**
 * Dono: P38 (portal da enfermeira): semana, ofertas e documentos. Sair já
 * funciona aqui porque o portal não tem barra lateral. O P12 acrescenta o
 * aviso de fila pendente antes de sair (telas.md, E9).
 */
export default async function PaginaPerfil() {
  const sessao = await exigirSessao();
  return (
    <>
      <CabecalhoTela titulo="Perfil" />
      <div className="flex flex-col gap-6 pt-6">
        <p className="text-corpo text-texto">
          <span className="font-semibold">{sessao.nome}</span>
          <br />
          <span className="text-apoio text-texto-2">{sessao.email}</span>
        </p>
        <EstadoVazio
          nivelTitulo="h2"
          titulo="A sua semana vai aparecer aqui"
          texto="O estado de hoje, a semana em turnos, as ofertas de família para aceitar ou recusar e os documentos com a validade."
        />
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
