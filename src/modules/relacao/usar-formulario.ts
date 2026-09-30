"use client";

import * as React from "react";

/**
 * Formulário com ação de servidor que **não apaga o que a pessoa digitou**
 * quando a ação recusa. No React 19, `<form action={...}>` limpa os campos
 * depois de cada envio, mesmo com erro; num texto longo (manual, entrevista,
 * candidatura) isso joga fora o trabalho. Aqui o envio é interceptado e a
 * ação roda na mesma transição do `useActionState`; quem quiser limpar depois
 * de um sucesso chama `form.reset()` no próprio componente.
 */
export function useFormularioSemReset<E>(
  acao: (anterior: E, dados: FormData) => Promise<E>,
  inicial: E,
) {
  const [estado, executar, pendente] = React.useActionState<E, FormData>(
    acao as (anterior: Awaited<E>, dados: FormData) => Promise<Awaited<E>>,
    inicial as Awaited<E>,
  );
  const aoEnviar = React.useCallback(
    (evento: React.FormEvent<HTMLFormElement>) => {
      evento.preventDefault();
      const dados = new FormData(evento.currentTarget);
      React.startTransition(() => {
        executar(dados);
      });
    },
    [executar],
  );
  return [estado, aoEnviar, pendente] as const;
}
