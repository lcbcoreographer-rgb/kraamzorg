/**
 * Estado das ações da proposta (acoes.ts). Fora de acoes.ts porque um
 * arquivo "use server" só exporta funções assíncronas.
 */
export interface EstadoAcaoProposta {
  erro?: string;
  sucesso?: string;
}

export const estadoInicialProposta: EstadoAcaoProposta = {};

/**
 * Link do formulário recém-gerado. Existe só na memória da tela: o banco
 * guarda o resumo (hash) do token, nunca o link. Recarregou a página, o
 * caminho é gerar outro (o anterior deixa de valer).
 */
export type ResultadoLinkFormulario =
  | {
      ok: true;
      tarefaId: string | null;
      expiraEm: string;
      /** Texto para a família, com o link, já pronto para o WhatsApp. */
      texto: string;
      /** wa.me com o texto, quando o freio e o telefone deixam. */
      whatsapp: string | null;
      /** Por que não há wa.me (telefone, freio), para a tela explicar. */
      motivoSemWhatsapp: string | null;
    }
  | { ok: false; erro: string };
