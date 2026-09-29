"use client";

import * as React from "react";
import type { EstadoAcaoOperacao } from "./estado-acoes";

/**
 * `useActionState` para formulário que não pode perder o que a pessoa
 * digitou. Com `<form action={...}>`, o React 19 limpa os campos depois de
 * cada envio, inclusive quando a resposta é um erro de validação, e a pessoa
 * teria de escolher tudo de novo. Aqui o envio é pelo `onSubmit`, dentro de
 * uma transição: o estado (erro, campos, sucesso) chega igual, e os campos
 * ficam como estão.
 */
export function useAcao(
  acao: (
    anterior: EstadoAcaoOperacao,
    dados: FormData,
  ) => Promise<EstadoAcaoOperacao>,
  inicial: EstadoAcaoOperacao,
) {
  const [estado, executar, pendente] = React.useActionState(acao, inicial);
  const enviar = React.useCallback(
    (evento: React.FormEvent<HTMLFormElement>) => {
      evento.preventDefault();
      const dados = new FormData(evento.currentTarget);
      React.startTransition(() => executar(dados));
    },
    [executar],
  );
  return { estado, enviar, pendente };
}
