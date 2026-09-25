/**
 * Estado das Server Actions de tarefas (`acoes.ts`). Mora fora de
 * `acoes.ts` de propósito: um arquivo com "use server" só pode exportar
 * funções assíncronas, e um objeto exportado de lá quebra o `next build`.
 */
export interface EstadoAcaoTarefa {
  erro?: string;
  sucesso?: string;
}

export const estadoInicialTarefa: EstadoAcaoTarefa = {};
