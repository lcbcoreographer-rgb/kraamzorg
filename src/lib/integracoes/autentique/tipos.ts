/**
 * Tipos do adaptador Autentique (PRD 14, P31). API GraphQL v2
 * (`https://api.autentique.com.br/v2/graphql`), token Bearer.
 *
 * Conferido na verificação da trilha (25/09/2026), por implementações
 * públicas que usam a API v2 (docs.autentique.com.br segue bloqueado na
 * rede do ambiente): `createDocument(sandbox, document, signers, file)`;
 * `SignerInput` com `name`, `email`, `phone`, `delivery_method`
 * (`DELIVERY_METHOD_WHATSAPP`, `DELIVERY_METHOD_SMS`, `DELIVERY_METHOD_LINK`)
 * e `action` (`SIGN`, `SIGN_AS_A_WITNESS`, `APPROVE`, `RECOGNIZE`); a query
 * `document(id)` devolve `signatures { public_id name email action { name }
 * link { short_link } signed { created_at } rejected { created_at } }`.
 * [conferir] reconfirmar no painel de homologação com a credencial real.
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
  recusadoEm: string | null;
  /** Link individual de assinatura, usado quando a entrega é por link. */
  linkCurto?: string;
}

export interface DocumentoAutentique {
  id: string;
  nome: string;
  criadoEm: string;
  signatarios: SignatarioAutentique[];
  /** Verdadeiro só quando todo signatário do documento (inclusive a
   * testemunha, quando houver) assinou e ninguém recusou: é o mesmo
   * critério do evento "documento finalizado" da Autentique (PRD 14). */
  concluido: boolean;
}

export interface ClienteAutentiqueOpcoes {
  token: string;
  /** Sandbox em homologação (PRD 14, "Sandbox em homologação"; P31 item 2). */
  sandbox: boolean;
  /** Injeção de dependência para teste (fetch interceptado, CLAUDE.md). */
  fetchImpl?: typeof fetch;
  /** Endpoint GraphQL; sandbox usa o mesmo endpoint com o argumento
   * `sandbox: true` na mutation `createDocument`. */
  endpoint?: string;
}
