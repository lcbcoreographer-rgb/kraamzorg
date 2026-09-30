/**
 * Estado das Server Actions do financeiro da Fase 3 (acoes.ts). Fora de
 * acoes.ts porque um arquivo "use server" só exporta funções assíncronas.
 */
export interface EstadoAcaoGestao {
  erro?: string;
  sucesso?: string;
  /** Mensagem por campo do formulário. */
  campos?: Record<string, string>;
}

export const estadoInicialGestao: EstadoAcaoGestao = {};
