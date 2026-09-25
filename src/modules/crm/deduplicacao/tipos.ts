export interface FamiliaDuplicata {
  id: string;
  nome: string;
  bairro: string | null;
  cidade: string | null;
  dpp: string | null;
}

export interface ParDuplicataCerta {
  tipo: "certa";
  a: FamiliaDuplicata;
  b: FamiliaDuplicata;
  /** Telefone em comum (E.164) que tornou a duplicata certa. */
  telefone: string;
}

export interface ParDuplicataProvavel {
  tipo: "provavel";
  a: FamiliaDuplicata;
  b: FamiliaDuplicata;
  /** 0 a 1, aproximação de `extensions.similarity` (pg_trgm). */
  similaridade: number;
  diasEntreDpp: number | null;
}

export type ParDuplicata = ParDuplicataCerta | ParDuplicataProvavel;

export interface ResultadoDuplicatas {
  certas: ParDuplicataCerta[];
  provaveis: ParDuplicataProvavel[];
  /** true quando o banco ainda não tem a função de detecção (0012 a 0014
   * são de outra trilha), diferente de "nenhuma duplicata encontrada". */
  indisponivelNoBanco: boolean;
}

export interface PedidoMesclagem {
  familiaFicaId: string;
  familiaPerdeId: string;
  /** Só quando as duas têm oportunidade aberta (P17 item 2, [v4.2]). */
  oportunidadeFicaId?: string;
  oportunidadePerdeId?: string;
}
