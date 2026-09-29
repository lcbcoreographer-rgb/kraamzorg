/**
 * Estado das ações da cobrança (acoes.ts). Fora de acoes.ts porque um
 * arquivo "use server" só exporta funções assíncronas.
 */
export interface EstadoAcaoCobranca {
  erro?: string;
  sucesso?: string;
  /** Campos com problema na baixa manual, para a tela marcar. */
  campos?: Partial<Record<"valor" | "comprovante" | "motivo", string>>;
}

export const estadoInicialCobranca: EstadoAcaoCobranca = {};
