import "server-only";
import type {
  ClienteAutentiqueOpcoes,
  CriarDocumentoAutentiqueEntrada,
  DocumentoAutentique,
  SignatarioAutentique,
  SignatarioAutentiqueEntrada,
} from "./tipos";

/**
 * Adaptador da Autentique (PRD 14, P31): `createDocument` com upload do PDF,
 * signatários (gestante e Kraamzorg assinam, parceiro testemunha) e sandbox
 * em homologação. Nada aqui chama a API real durante teste: os testes
 * interceptam `fetchImpl` (CLAUDE.md, "integração com terceiro testada com
 * respostas simuladas").
 *
 * Formato da API conferido na verificação da trilha (ver tipos.ts).
 */

const ENDPOINT_PADRAO = "https://api.autentique.com.br/v2/graphql";

const MUTATION_CRIAR_DOCUMENTO = `
  mutation CriarDocumento(
    $document: DocumentInput!
    $signers: [SignerInput!]!
    $file: Upload!
    $sandbox: Boolean
  ) {
    createDocument(
      document: $document
      signers: $signers
      file: $file
      sandbox: $sandbox
    ) {
      id
      name
      created_at
      signatures {
        public_id
        name
        email
        action { name }
        link { short_link }
        signed { created_at }
        rejected { created_at }
      }
    }
  }
`;

const QUERY_BUSCAR_DOCUMENTO = `
  query BuscarDocumento($id: UUID!) {
    document(id: $id) {
      id
      name
      created_at
      signatures {
        public_id
        name
        email
        action { name }
        link { short_link }
        signed { created_at }
        rejected { created_at }
      }
    }
  }
`;

/** Valores do enum de ação do signatário na API v2 da Autentique. */
const ACAO_ASSINAR = "SIGN";
const ACAO_TESTEMUNHA = "SIGN_AS_A_WITNESS";

function papelDaAcao(nomeAcao: string | undefined): "assinar" | "testemunha" {
  return nomeAcao === ACAO_TESTEMUNHA ? "testemunha" : "assinar";
}

/**
 * Monta o `SignerInput`. Entrega pela própria Autentique (PRD 14): por
 * e-mail quando houver e-mail; senão por WhatsApp quando houver telefone;
 * sem nenhum dos dois, por link (o `short_link` volta na resposta).
 */
export function paraSignerInput(signatario: SignatarioAutentiqueEntrada) {
  const action =
    signatario.papel === "testemunha" ? ACAO_TESTEMUNHA : ACAO_ASSINAR;
  if (signatario.email) {
    return { name: signatario.nome, email: signatario.email, action };
  }
  if (signatario.telefone) {
    return {
      name: signatario.nome,
      phone: signatario.telefone,
      delivery_method: "DELIVERY_METHOD_WHATSAPP",
      action,
    };
  }
  return {
    name: signatario.nome,
    delivery_method: "DELIVERY_METHOD_LINK",
    action,
  };
}

interface RespostaGraphQL<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

interface DocumentoBruto {
  id: string;
  name: string;
  created_at: string;
  signatures: Array<{
    public_id: string;
    name: string;
    email: string | null;
    action?: { name: string } | null;
    link?: { short_link: string | null } | null;
    signed?: { created_at: string } | null;
    rejected?: { created_at: string } | null;
  }>;
}

function mapearDocumento(bruto: DocumentoBruto): DocumentoAutentique {
  const signatarios: SignatarioAutentique[] = bruto.signatures.map((s) => ({
    publicId: s.public_id,
    nome: s.name,
    email: s.email ?? undefined,
    papel: papelDaAcao(s.action?.name),
    assinadoEm: s.signed?.created_at ?? null,
    recusadoEm: s.rejected?.created_at ?? null,
    linkCurto: s.link?.short_link ?? undefined,
  }));
  // Finalizado só com todas as assinaturas (partes e testemunha) e nenhuma
  // recusa. Lista vazia nunca conta como concluída.
  const concluido =
    signatarios.length > 0 &&
    signatarios.every((s) => s.assinadoEm !== null && s.recusadoEm === null);
  return {
    id: bruto.id,
    nome: bruto.name,
    criadoEm: bruto.created_at,
    signatarios,
    concluido,
  };
}

async function chamarGraphQL<T>(
  opcoes: Omit<ClienteAutentiqueOpcoes, "sandbox">,
  query: string,
  variables: Record<string, unknown>,
  arquivo?: CriarDocumentoAutentiqueEntrada["arquivo"],
): Promise<T> {
  const fetchImpl = opcoes.fetchImpl ?? fetch;
  const endpoint = opcoes.endpoint ?? ENDPOINT_PADRAO;

  let corpo: BodyInit;
  const cabecalhos: Record<string, string> = {
    Authorization: `Bearer ${opcoes.token}`,
  };

  if (arquivo) {
    // GraphQL multipart request spec: operations + map + arquivo binário.
    const formData = new FormData();
    formData.set(
      "operations",
      JSON.stringify({ query, variables: { ...variables, file: null } }),
    );
    formData.set("map", JSON.stringify({ "0": ["variables.file"] }));
    formData.set(
      "0",
      new Blob([new Uint8Array(arquivo.conteudo)], {
        type: arquivo.tipoConteudo,
      }),
      arquivo.nomeArquivo,
    );
    corpo = formData;
  } else {
    cabecalhos["Content-Type"] = "application/json";
    corpo = JSON.stringify({ query, variables });
  }

  const resposta = await fetchImpl(endpoint, {
    method: "POST",
    headers: cabecalhos,
    body: corpo,
  });

  if (!resposta.ok) {
    throw new Error(
      `Autentique: resposta HTTP ${resposta.status} ao chamar a API`,
    );
  }

  const json = (await resposta.json()) as RespostaGraphQL<T>;
  if (json.errors?.length) {
    throw new Error(
      `Autentique: erro da API (${json.errors.map((e) => e.message).join("; ")})`,
    );
  }
  if (!json.data) {
    throw new Error("Autentique: resposta sem dado");
  }
  return json.data;
}

export async function criarDocumento(
  opcoes: ClienteAutentiqueOpcoes,
  entrada: CriarDocumentoAutentiqueEntrada,
): Promise<DocumentoAutentique> {
  const signers = [
    paraSignerInput(entrada.gestante),
    paraSignerInput(entrada.kraamzorg),
    ...(entrada.testemunha ? [paraSignerInput(entrada.testemunha)] : []),
  ];

  const data = await chamarGraphQL<{ createDocument: DocumentoBruto }>(
    opcoes,
    MUTATION_CRIAR_DOCUMENTO,
    {
      document: { name: entrada.nomeDocumento },
      signers,
      sandbox: opcoes.sandbox,
    },
    entrada.arquivo,
  );
  return mapearDocumento(data.createDocument);
}

/**
 * Sandbox da Autentique (PRD 14, "Sandbox em homologação"). Lido de
 * `AUTENTIQUE_SANDBOX`, só do servidor: qualquer valor diferente de "false"
 * mantém o sandbox ligado, para que um ambiente mal configurado nunca gaste
 * crédito nem gere documento com validade jurídica por engano.
 */
export function sandboxAutentiqueLigado(
  valor: string | undefined = process.env.AUTENTIQUE_SANDBOX,
): boolean {
  return valor !== "false";
}

export async function buscarDocumento(
  opcoes: Omit<ClienteAutentiqueOpcoes, "sandbox">,
  documentoId: string,
): Promise<DocumentoAutentique> {
  const data = await chamarGraphQL<{ document: DocumentoBruto }>(
    opcoes,
    QUERY_BUSCAR_DOCUMENTO,
    { id: documentoId },
  );
  return mapearDocumento(data.document);
}
