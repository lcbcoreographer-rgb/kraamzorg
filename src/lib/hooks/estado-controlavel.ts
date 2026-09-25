"use client";

import * as React from "react";

/**
 * Estado controlado ou não controlado, no padrão do Radix
 * (`@radix-ui/react-use-controllable-state`, sem trazer a dependência: o
 * hook é pequeno e o projeto já não usa mais primitivos Radix de formulário
 * além do Dialog). Sem `valor`, o componente vira não controlado e guarda o
 * próprio estado a partir de `valorPadrao`; com `valor`, quem chama manda,
 * como sempre (achado da auditoria da P10 parcial: `SimNao`, `Escala0a10`,
 * `EscolhaUnica` e `EscolhaMultipla` só funcionavam com `valor` controlado
 * de fora, e sem ele o toque não marcava nada, em silêncio).
 */
export function useEstadoControlavel<T>(
  valorControlado: T | undefined,
  valorPadrao: T | undefined,
  aoMudar?: (valor: T) => void,
): [T | undefined, (valor: T) => void] {
  const [estadoInterno, definirEstadoInterno] = React.useState<T | undefined>(
    valorPadrao,
  );
  const controlado = valorControlado !== undefined;
  const valor = controlado ? valorControlado : estadoInterno;

  const definirValor = React.useCallback(
    (proximoValor: T) => {
      if (!controlado) {
        definirEstadoInterno(proximoValor);
      }
      aoMudar?.(proximoValor);
    },
    [controlado, aoMudar],
  );

  return [valor, definirValor];
}
