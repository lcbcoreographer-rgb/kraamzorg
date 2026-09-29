import type {
  ConflitoAgenda,
  VisitaDaCascata,
  VisitaAfetada,
} from "@/lib/dados/tipos-equipe";

/**
 * Estado das ações da equipe e da agenda (acoes.ts). Fora de acoes.ts porque
 * um arquivo "use server" só exporta funções assíncronas.
 */
export interface EstadoAcaoEquipe {
  erro?: string;
  sucesso?: string;
  /** Erro de um campo específico (nome do campo no formulário). */
  campos?: Record<string, string>;
  /** Visitas que caem em dias de um bloqueio recém-salvo. */
  visitasAfetadas?: VisitaAfetada[];
}

export const estadoInicialEquipe: EstadoAcaoEquipe = {};

/** Resposta de uma verificação de conflito, antes de salvar. */
export type ResultadoVerificacaoVisita =
  { ok: true; conflitos: ConflitoAgenda[] } | { ok: false; erro: string };

export type ResultadoVerificacaoCascata =
  | {
      ok: true;
      deslocamentoDias: number;
      conflitosTotal: number;
      visitas: VisitaDaCascata[];
    }
  | { ok: false; erro: string };
