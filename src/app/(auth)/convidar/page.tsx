import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { exigirSessao } from "@/lib/auth/sessao";
import { FormularioConvite } from "../_componentes/formularios";

export const metadata: Metadata = { title: "Convidar pessoa · Kraamzorg OS" };

/**
 * Convite de usuário pela diretoria (P07 item 6). O proxy só deixa a
 * diretoria em AAL2 chegar aqui; a Server Action confere de novo e o banco
 * confere a terceira vez (RLS de usuario_papel).
 */
export default async function PaginaConvidar() {
  await exigirSessao("/convidar");
  return (
    <>
      <Botao
        asChild
        variante="fantasma"
        tamanho="compacto"
        className="-ml-3 self-start"
      >
        <Link href="/sessoes">
          <ArrowLeft aria-hidden="true" className="size-5" strokeWidth={1.75} />
          Voltar para sessões e acessos
        </Link>
      </Botao>
      <div className="flex flex-col gap-2">
        <h1 className="font-titulo text-display text-texto font-normal">
          Convidar pessoa
        </h1>
        <p className="text-corpo text-texto">
          A pessoa recebe um e-mail com o link para criar a senha. Papel com
          dado de saúde ou financeiro cadastra o código do aplicativo no
          primeiro acesso.
        </p>
      </div>
      <FormularioConvite />
    </>
  );
}
