"use client";

import { useActionState } from "react";
import { Botao } from "@/components/ui/botao";
import { ativarPacoteAction, type EstadoFormulario } from "../acoes/pacotes";

const inicial: EstadoFormulario = {};

export function AlternarPacoteAtivo({
  pacoteId,
  ativo,
}: {
  pacoteId: string;
  ativo: boolean;
}) {
  const [, acao, enviando] = useActionState(ativarPacoteAction, inicial);

  return (
    <form action={acao}>
      <input type="hidden" name="pacoteId" value={pacoteId} />
      <input type="hidden" name="ativo" value={(!ativo).toString()} />
      <Botao
        type="submit"
        variante="fantasma"
        tamanho="compacto"
        carregando={enviando}
      >
        {ativo ? "Desativar" : "Reativar"}
      </Botao>
    </form>
  );
}
