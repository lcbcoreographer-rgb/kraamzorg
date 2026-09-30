"use client";

import * as React from "react";
import type { EstadoAcaoGestao } from "./estado-acoes";

/**
 * `useActionState` para formulário que não pode perder o que a pessoa
 * digitou. Com `<form action={...}>`, o React 19 limpa os campos depois de
 * cada envio, inclusive quando a resposta é um erro de validação. Aqui o
 * envio é pelo `onSubmit`, dentro de uma transição: o estado (erro, campos,
 * sucesso) chega igual, e os campos ficam como estão.
 */
export function useAcaoGestao(
  acao: (
    anterior: EstadoAcaoGestao,
    dados: FormData,
  ) => Promise<EstadoAcaoGestao>,
  inicial: EstadoAcaoGestao,
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
