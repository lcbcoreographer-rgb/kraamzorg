/**
 * Resposta da ação de envio da pesquisa pública (acoes.ts). Mora fora de
 * acoes.ts porque um arquivo "use server" só exporta funções assíncronas.
 * Nenhuma variante carrega o que a pessoa respondeu: só códigos.
 */
export type ResultadoEnvioPesquisaTela =
  | { situacao: "recebido" }
  | { situacao: "corrigir"; erros: Record<string, string> }
  | { situacao: "invalido" }
  | { situacao: "limite"; minutos: number | null }
  | {
      situacao: "verificacao";
      motivo: "sem_token" | "recusado" | "indisponivel";
    }
  | { situacao: "erro" };

export interface PedidoEnvioPesquisa {
  token: string;
  respostas: Record<string, string | number | boolean>;
  /** Token do widget do Turnstile. */
  verificacao: string | null;
}
