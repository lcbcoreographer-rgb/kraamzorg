"use client";

import { useActionState } from "react";
import { Botao } from "@/components/ui/botao";
import { acaoConfirmarLinkPortal } from "../acoes";
import { estadoInicialConfirmacao } from "../tipos";

/** O botão que gasta o link (só uma pessoa toca; pré-visualização de e-mail não). */
export function ConfirmarEntrada({
  tokenHash,
  demo,
  rotulo,
}: {
  tokenHash: string;
  demo: string;
  rotulo: string;
}) {
  const [estado, acao, enviando] = useActionState(
    acaoConfirmarLinkPortal,
    estadoInicialConfirmacao,
  );
  return (
    <form action={acao} className="flex flex-col gap-4">
      <input type="hidden" name="token_hash" value={tokenHash} />
      <input type="hidden" name="demo" value={demo} />
      <Botao
        type="submit"
        largaTotal
        carregando={enviando}
        rotuloCarregando="Entrando"
      >
        {rotulo}
      </Botao>
      <p role="status" className="text-corpo text-texto min-h-6">
        {estado.erro ?? ""}
      </p>
    </form>
  );
}
