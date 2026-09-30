/**
 * Estado das ações da evolução (acoes.ts). Fora de acoes.ts porque um
 * arquivo "use server" só exporta funções assíncronas.
 */
export interface EstadoAcaoEvolucao {
  erro?: string;
  sucesso?: string;
  /** Pontos que o documento ainda precisa corrigir, quando a ação é salvar. */
  pontos?: string[];
  /** Versão do documento depois de salvar, para o próximo envio conferir. */
  versao?: number;
}

export const estadoInicialEvolucao: EstadoAcaoEvolucao = {};
