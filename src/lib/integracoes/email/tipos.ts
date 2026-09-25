/** Tipos do adaptador de e-mail transacional (PRD 14, Resend). */

export interface AnexoEmail {
  nomeArquivo: string;
  conteudo: Uint8Array;
  tipoConteudo: string;
}

export interface EnviarEmailEntrada {
  de: string;
  para: string[];
  assunto: string;
  corpoHtml: string;
  anexos?: AnexoEmail[];
  /**
   * Nomes que o assunto e o nome dos anexos nunca podem conter (gestante,
   * bebê, pagador etc.), conferidos antes do envio (CLAUDE.md, "nome de
   * paciente nunca em... assunto de e-mail"). Obrigatório: quem envia tem
   * de dizer de quem é o e-mail; lista vazia só quando o e-mail não é sobre
   * nenhuma pessoa. CPF, telefone e e-mail no assunto são recusados sempre.
   */
  nomesProibidosNoAssunto: readonly string[];
}

export interface ResultadoEnvioEmail {
  id: string;
}

export interface ClienteEmailOpcoes {
  apiKey: string;
  fetchImpl?: typeof fetch;
  endpoint?: string;
}
