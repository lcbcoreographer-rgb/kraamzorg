/**
 * Estado das ações de ocorrência e de pós-venda (acoes.ts). Fora de acoes.ts
 * porque um arquivo "use server" só exporta funções assíncronas.
 */
export interface EstadoAcaoOcorrencia {
  erro?: string;
  sucesso?: string;
  /** Campos com problema no formulário de nova ocorrência. */
  campos?: Partial<Record<"familia" | "tipo" | "titulo" | "descricao", string>>;
  /** Versão da ocorrência depois de atualizar, para o próximo envio conferir. */
  versao?: number;
  /** Link da pesquisa gerado (o texto que a coordenação copia para a família). */
  texto?: string;
}

export const estadoInicialOcorrencia: EstadoAcaoOcorrencia = {};
