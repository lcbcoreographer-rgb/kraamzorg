/**
 * Estado das Server Actions da operação. Mora fora de `acoes.ts` de propósito:
 * um arquivo com "use server" só pode exportar funções assíncronas.
 */
export interface EstadoAcaoOperacao {
  erro?: string;
  sucesso?: string;
  /** Mensagem por campo do formulário. */
  campos?: Record<string, string>;
}

export const estadoInicialOperacao: EstadoAcaoOperacao = {};
