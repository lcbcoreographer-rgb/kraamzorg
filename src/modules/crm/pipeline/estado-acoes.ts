/**
 * Estado das Server Actions de `acoes.ts`. Mora fora de `acoes.ts` de
 * propósito: um arquivo com "use server" só pode exportar funções
 * assíncronas, e o Next recusa o módulo inteiro, na hora de carregar,
 * quando ele exporta outro valor (este objeto de estado inicial, por
 * exemplo). Sem isso todos os botões da tela davam erro 500.
 */
export interface EstadoAcaoPipeline {
  erro?: string;
  sucesso?: string;
}

export const estadoInicialPipeline: EstadoAcaoPipeline = {};
