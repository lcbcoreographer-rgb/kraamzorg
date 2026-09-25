"use client";

import { useActionState } from "react";
import { Botao } from "@/components/ui/botao";
import {
  alternarTermoAlertaAction,
  type EstadoFormulario,
} from "../acoes/termos-alerta";

const inicial: EstadoFormulario = {};

export function AlternarTermoAtivo({
  id,
  ativo,
}: {
  id: string;
  ativo: boolean;
}) {
  const [, acao, enviando] = useActionState(alternarTermoAlertaAction, inicial);

  return (
    <form action={acao}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="ativo" value={(!ativo).toString()} />
      <Botao
        type="submit"
        variante="fantasma"
        tamanho="compacto"
        carregando={enviando}
      >
        {ativo ? "Desativar" : "Ativar"}
      </Botao>
    </form>
  );
}
