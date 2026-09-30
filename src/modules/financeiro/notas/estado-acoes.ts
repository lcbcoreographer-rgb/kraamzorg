/**
 * Estado das ações da nota fiscal (acoes.ts). Fora de acoes.ts porque um
 * arquivo "use server" só exporta funções assíncronas.
 */
export interface DadosParaEmissaoManual {
  tomadorNome: string;
  /** CPF formatado, lido do banco com registro no log (só sob pedido). */
  tomadorCpf: string;
  tomadorEmail: string | null;
  endereco: string | null;
  valor: string;
  codigoServico: string;
  descricaoServico: string;
}

export interface EstadoAcaoNota {
  erro?: string;
  sucesso?: string;
  /** Campos com problema no registro manual, para a tela marcar. */
  campos?: Partial<Record<"numero" | "emitidaEm" | "pdf" | "xml", string>>;
  /** Os dados da emissão manual, mostrados só depois do pedido explícito. */
  dados?: DadosParaEmissaoManual;
}

export const estadoInicialNota: EstadoAcaoNota = {};
