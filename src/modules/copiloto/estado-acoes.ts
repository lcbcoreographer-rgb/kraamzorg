import type { RespostaCopiloto } from "./orquestrador";

/**
 * Estado da ação do copiloto. Fora de acoes.ts porque um arquivo "use
 * server" só exporta funções assíncronas.
 */
export interface EstadoCopiloto {
  pergunta?: string;
  resposta?: RespostaCopiloto;
}

export const estadoInicialCopiloto: EstadoCopiloto = {};
