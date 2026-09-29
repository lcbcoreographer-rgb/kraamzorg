import type { ItemResumo } from "@/lib/dados/tipos-venda";

/**
 * Estado das ações de sessão de venda (acoes.ts). Fora de acoes.ts porque
 * um arquivo "use server" só exporta funções assíncronas.
 */
export interface EstadoAcaoSessao {
  erro?: string;
  sucesso?: string;
  /** Erro de um campo específico (nome do campo no formulário). */
  campos?: Record<string, string>;
}

export const estadoInicialSessao: EstadoAcaoSessao = {};

export interface ResumoGerado {
  duvidas: ItemResumo[];
  objecoes: ItemResumo[];
  planoInteresse: ItemResumo | null;
  proximosPassos: ItemResumo[];
  descartados: number;
  modelo: string;
}

export type ResultadoGerarResumo =
  { ok: true; resumo: ResumoGerado } | { ok: false; erro: string };
