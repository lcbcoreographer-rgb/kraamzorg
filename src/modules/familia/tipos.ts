/**
 * Tipos das ações do portal da família (P49), fora de acoes.ts porque um
 * arquivo "use server" só exporta funções assíncronas.
 */
export interface PedidoLinkPortal {
  email: string;
  verificacao: string | null;
}

export type ResultadoPedidoLink =
  | {
      situacao: "enviado";
      /** Só na demonstração (sem e-mail de verdade): o link aparece na tela. */
      linkDemonstracao?: string;
    }
  | { situacao: "limite" | "verificacao" | "invalido" | "erro" };

export interface EstadoConfirmacao {
  erro?: string;
}

export const estadoInicialConfirmacao: EstadoConfirmacao = {};
