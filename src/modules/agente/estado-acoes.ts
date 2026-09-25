/**
 * Estado das Server Actions do agente (`acoes.ts`, `admin-acoes.ts` e
 * `conversa-detalhe/acoes.ts`). Mora fora desses arquivos de propósito: um
 * arquivo com "use server" só pode exportar funções assíncronas, e o Next
 * recusa o módulo inteiro na hora de carregar se ele exportar qualquer outro
 * valor (o objeto de estado inicial, por exemplo), derrubando todas as ações.
 */
export interface EstadoAcaoAgente {
  erro?: string;
  sucesso?: string;
}

export const estadoInicialAgente: EstadoAcaoAgente = {};

export interface EstadoAcaoAdmin {
  erro?: string;
  sucesso?: string;
}

export const estadoInicialAdmin: EstadoAcaoAdmin = {};

export interface EstadoEnvioConversa {
  erro?: string;
  sucesso?: string;
  /** Canal manual: o freio passou e o envio segue pelo WhatsApp do aparelho. */
  link?: string;
}

export const estadoInicialEnvioConversa: EstadoEnvioConversa = {};
