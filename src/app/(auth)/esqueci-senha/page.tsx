import type { Metadata } from "next";
import { FormularioRecuperacao } from "../_componentes/formularios";

export const metadata: Metadata = { title: "Esqueci a senha · Kraamzorg OS" };

/** Pedido de link para criar senha nova. Não revela se o e-mail existe. */
export default function PaginaEsqueciSenha() {
  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="font-titulo text-display text-texto font-normal">Esqueci a senha</h1>
        <p className="text-corpo text-texto">
          Digite o e-mail de acesso. Mandamos um link para você criar uma senha nova.
        </p>
      </div>
      <FormularioRecuperacao />
    </>
  );
}
