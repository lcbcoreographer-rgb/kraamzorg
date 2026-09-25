import type { DadosContratoTela } from "./tipos";

/**
 * Estado das Server Actions da ficha (`acoes.ts`). Mora fora de `acoes.ts`
 * de propósito: um arquivo com "use server" só pode exportar funções
 * assíncronas, e o Next recusa na hora de carregar o módulo qualquer outro
 * valor exportado (objeto de estado inicial, por exemplo).
 */
export interface EstadoAcaoFicha {
  erro?: string;
  sucesso?: string;
  /** Só no acionamento do freio: segundos que o "Desfazer" ainda vale. */
  desfazerSegundos?: number;
}

export const estadoInicialFicha: EstadoAcaoFicha = {};

export interface EstadoDadosContrato {
  erro?: string;
  dados?: DadosContratoTela;
}

export const estadoInicialDadosContrato: EstadoDadosContrato = {};
