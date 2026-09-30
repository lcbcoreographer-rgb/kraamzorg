/**
 * Estado das ações do contrato (acoes.ts). Fora de acoes.ts porque um
 * arquivo "use server" só exporta funções assíncronas.
 */
export interface EstadoAcaoContrato {
  erro?: string;
  sucesso?: string;
}

export const estadoInicialContrato: EstadoAcaoContrato = {};
