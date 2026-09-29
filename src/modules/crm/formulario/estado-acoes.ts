import type { Erros, IdEtapa } from "./validacao";

/**
 * Resposta da ação de envio do formulário público (acoes.ts). Mora fora de
 * acoes.ts porque um arquivo "use server" só exporta funções assíncronas.
 * Nenhuma variante carrega o que a pessoa digitou: só códigos e frases.
 */
export type ResultadoEnvioTela =
  | { situacao: "recebido" }
  | { situacao: "corrigir"; erros: Erros; etapa: IdEtapa }
  | { situacao: "invalido" }
  | { situacao: "limite"; minutos: number | null }
  | {
      situacao: "verificacao";
      motivo: "sem_token" | "recusado" | "indisponivel";
    }
  | { situacao: "erro" };

export interface PedidoEnvioFormulario {
  token: string;
  valores: Record<string, string>;
  /** Token do widget do Turnstile. */
  verificacao: string | null;
}
