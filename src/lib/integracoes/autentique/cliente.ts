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
 * [conferir] Endpoint e formato exatos reconfirmados contra
 * docs.autentique.com.br antes de ligar a credencial real (ver tipos.ts).
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
        signed { created_at }
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
        signed { created_at }
      }
    }
  }
`;

/** Ação SIGN/APPROVE assina; WITNESS testemunha. [conferir] nomes exatos do
 * enum `SignerAction` da Autentique. */
function papelDaAcao(nomeAcao: string | undefined): "assinar" | "testemunha" {
  return nomeAcao === "WITNESS" ? "testemunha" : "assinar";
}

function paraSignerInput(signatario: SignatarioAutentiqueEntrada) {
  return {
    email: signatario.email,
    phone: signatario.telefone,
    action: signatario.papel === "testemunha" ? "WITNESS" : "SIGN",
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
    signed?: { created_at: string } | null;
  }>;
}

function mapearDocumento(bruto: DocumentoBruto): DocumentoAutentique {
  const signatarios: SignatarioAutentique[] = bruto.signatures.map((s) => ({
    publicId: s.public_id,
    nome: s.name,
    email: s.email ?? undefined,
    papel: papelDaAcao(s.action?.name),
    assinadoEm: s.signed?.created_at ?? null,
  }));
  const concluido = signatarios
    .filter((s) => s.papel === "assinar")
    .every((s) => s.assinadoEm !== null);
  return {
    id: bruto.id,
    nome: bruto.name,
    criadoEm: bruto.created_at,
    signatarios,
    concluido,
  };
}

async function chamarGraphQL<T>(
  opcoes: ClienteAutentiqueOpcoes,
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

export async function buscarDocumento(
  opcoes: ClienteAutentiqueOpcoes,
  documentoId: string,
): Promise<DocumentoAutentique> {
  const data = await chamarGraphQL<{ document: DocumentoBruto }>(
    opcoes,
    QUERY_BUSCAR_DOCUMENTO,
    { id: documentoId },
  );
  return mapearDocumento(data.document);
}
