/**
 * Tipos do adaptador Autentique (PRD 14, P31). API GraphQL v2
 * (`https://api.autentique.com.br/v2/graphql`), token Bearer.
 *
 * [conferir] Os nomes exatos dos campos da mutation `createDocument` e do
 * enum de ação do signatário não puderam ser reconferidos na documentação
 * oficial nesta sessão (docs.autentique.com.br bloqueado na rede do
 * ambiente). O formato abaixo segue a descrição do PRD 14 e o padrão GraphQL
 * multipart request spec que a Autentique documenta publicamente. Reconfira
 * contra `docs.autentique.com.br/api/2/mutations/criando-um-documento` antes
 * de ligar a credencial real.
 */

/** Papel do signatário no documento: quem assina ou quem testemunha. */
export type PapelSignatarioAutentique = "assinar" | "testemunha";

export interface SignatarioAutentiqueEntrada {
  nome: string;
  email?: string;
  /** Telefone em E.164 (CLAUDE.md), quando o envio for por WhatsApp. */
  telefone?: string;
  papel: PapelSignatarioAutentique;
}

export interface ArquivoParaAssinatura {
  nomeArquivo: string;
  /** Conteúdo binário do PDF gerado pelo P31 (`@react-pdf/renderer`). */
  conteudo: Uint8Array;
  tipoConteudo: string;
}

export interface CriarDocumentoAutentiqueEntrada {
  /** Nome do documento como aparece no painel da Autentique. Nunca leva o
   * nome da gestante (CLAUDE.md, "nome de paciente nunca em... assunto de
   * e-mail, metadado"); use o id do contrato. */
  nomeDocumento: string;
  arquivo: ArquivoParaAssinatura;
  gestante: SignatarioAutentiqueEntrada;
  kraamzorg: SignatarioAutentiqueEntrada;
  /** Parceiro como testemunha (PRD 14, P31 item 2). Opcional: nem toda
   * família tem parceiro presente no formulário (P30, "parceiro como
   * testemunha [confirmar]"). */
  testemunha?: SignatarioAutentiqueEntrada;
}

export interface SignatarioAutentique {
  publicId: string;
  nome: string;
  email?: string;
  papel: PapelSignatarioAutentique;
  assinadoEm: string | null;
}

export interface DocumentoAutentique {
  id: string;
  nome: string;
  criadoEm: string;
  signatarios: SignatarioAutentique[];
  /** Verdadeiro só quando todo signatário que precisa assinar (papel
   * "assinar") tem `assinadoEm` preenchido. Testemunha não bloqueia. */
  concluido: boolean;
  linkCurto?: string;
}

export interface ClienteAutentiqueOpcoes {
  token: string;
  /** Sandbox em homologação (PRD 14, "Sandbox em homologação"; P31 item 2). */
  sandbox: boolean;
  /** Injeção de dependência para teste (fetch interceptado, CLAUDE.md). */
  fetchImpl?: typeof fetch;
  /** [conferir] endpoint de produção; sandbox usa o mesmo endpoint com o
   * argumento `sandbox: true` na mutation, conforme a documentação pública. */
  endpoint?: string;
}
