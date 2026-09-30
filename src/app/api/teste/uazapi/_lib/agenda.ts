import { criarCalendarioSimulado } from "../../../../../../n8n/src/lib/calendario-simulado.mjs";

/**
 * O Google Calendar de mentira do roteiro de homologação (P25b, P28): com
 * `homologacao.agendaSimulada`, os nós do Google Calendar do fluxo 4 do n8n
 * viram chamadas HTTP a `/api/teste/uazapi/agenda/...` e caem aqui. É o mesmo
 * módulo que os testes do n8n usam (`n8n/src/lib/calendario-simulado.mjs`), então
 * o formato de retorno e os defeitos que importam (evento apagado volta como
 * `cancelled`, id repetido devolve 409, calendário fora do ar) são idênticos.
 * Fica em `globalThis`, como a loja da captura, para valer entre rotas e
 * sobreviver à recarga de módulo do `next dev`.
 *
 * Nenhum calendário real: o `calendarId` que o n8n manda é o de exemplo do
 * config de homologação e só serve de chave.
 */

export type CalendarioSimulado = ReturnType<typeof criarCalendarioSimulado>;

const CHAVE_GLOBAL = "__kraamzorgCalendarioTeste";

export function obterCalendarioTeste(): CalendarioSimulado {
  const global = globalThis as unknown as Record<
    string,
    CalendarioSimulado | undefined
  >;
  global[CHAVE_GLOBAL] ??= criarCalendarioSimulado();
  return global[CHAVE_GLOBAL];
}

export function reiniciarCalendarioTeste(): CalendarioSimulado {
  const global = globalThis as unknown as Record<
    string,
    CalendarioSimulado | undefined
  >;
  global[CHAVE_GLOBAL] = criarCalendarioSimulado();
  return global[CHAVE_GLOBAL];
}

/** Operações que o fluxo 4 chama (POST), na ordem em que aparecem no build. */
export const OPERACOES_DO_FLUXO_4 = [
  "livre-ocupado",
  "eventos",
  "eventos/obter",
  "eventos/atualizar",
  "eventos/excluir",
] as const;

export type OperacaoDoFluxo4 = (typeof OPERACOES_DO_FLUXO_4)[number];

export function ehOperacaoDoFluxo4(valor: string): valor is OperacaoDoFluxo4 {
  return (OPERACOES_DO_FLUXO_4 as readonly string[]).includes(valor);
}
