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
   * Nomes que o assunto nunca pode conter (nome da gestante, do bebê etc.),
   * conferidos antes do envio (CLAUDE.md, "nome de paciente nunca em...
   * assunto de e-mail"). Quando quem chama sabe o nome do paciente do
   * contexto (por exemplo o envio de evolução do P41), passa a lista aqui;
   * `enviarEmail` recusa o envio se o assunto contiver algum deles.
   */
  nomesProibidosNoAssunto?: string[];
}

export interface ResultadoEnvioEmail {
  id: string;
}

export interface ClienteEmailOpcoes {
  apiKey: string;
  fetchImpl?: typeof fetch;
  endpoint?: string;
}
