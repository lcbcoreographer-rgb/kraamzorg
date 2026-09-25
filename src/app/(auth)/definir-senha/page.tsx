import type { Metadata } from "next";
import { exigirSessao } from "@/lib/auth/sessao";
import { FormularioDefinirSenha } from "../_componentes/formularios";

export const metadata: Metadata = { title: "Criar senha · Kraamzorg OS" };

/**
 * Senha nova, para quem chegou pelo link do convite ou do "Esqueci a
 * senha" (a rota /auth/confirmar já abriu a sessão). Depois de salvar, o
 * proxy leva ao cadastro do MFA quando o papel exige.
 */
export default async function PaginaDefinirSenha() {
  const sessao = await exigirSessao();
  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="font-titulo text-display text-texto font-normal">Crie a sua senha</h1>
        <p className="text-corpo text-texto">
          Acesso de <span className="font-semibold">{sessao.email}</span>. Use uma frase longa, só
          sua, que você não usa em outro lugar.
        </p>
      </div>
      <FormularioDefinirSenha />
    </>
  );
}
