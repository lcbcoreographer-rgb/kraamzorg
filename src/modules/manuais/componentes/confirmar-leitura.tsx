"use client";

import * as React from "react";
import { Botao } from "@/components/ui/botao";
import { acaoConfirmarLeitura } from "../acoes";

/** Botão "Li e entendi" da versão atual do manual (P51 item 2). */
export function ConfirmarLeitura({
  versaoId,
  jaLido,
}: {
  versaoId: string;
  jaLido: boolean;
}) {
  const [aviso, definirAviso] = React.useState<{
    erro?: string;
    sucesso?: string;
  }>({});
  const [ocupado, iniciar] = React.useTransition();
  if (jaLido || aviso.sucesso) {
    return (
      <p role="status" className="text-corpo text-sucesso">
        {aviso.sucesso ?? "Você já confirmou a leitura desta versão."}
      </p>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Botao
        type="button"
        carregando={ocupado}
        rotuloCarregando="Confirmando"
        onClick={() =>
          iniciar(async () =>
            definirAviso(await acaoConfirmarLeitura(versaoId)),
          )
        }
      >
        Li e entendi esta versão
      </Botao>
      <span role="status" className="text-apoio text-texto-2">
        {aviso.erro ?? ""}
      </span>
    </div>
  );
}
