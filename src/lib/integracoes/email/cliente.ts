import "server-only";
import { garantirAssuntoSemDadoPessoal } from "./guarda";
import type {
  ClienteEmailOpcoes,
  EnviarEmailEntrada,
  ResultadoEnvioEmail,
} from "./tipos";

/**
 * Adaptador de e-mail transacional com Resend (PRD 14). Nunca chama a API
 * real em teste: `fetchImpl` é interceptado (CLAUDE.md).
 */

const ENDPOINT_PADRAO = "https://api.resend.com/emails";

function paraBase64(bytes: Uint8Array): string {
  let binario = "";
  for (const byte of bytes) binario += String.fromCharCode(byte);
  // Buffer existe no runtime Node das rotas de API (server-only); evita
  // depender de btoa, que não existe em todo runtime de servidor.
  return typeof Buffer !== "undefined"
    ? Buffer.from(binario, "binary").toString("base64")
    : btoa(binario);
}

export async function enviarEmail(
  opcoes: ClienteEmailOpcoes,
  entrada: EnviarEmailEntrada,
): Promise<ResultadoEnvioEmail> {
  garantirAssuntoSemDadoPessoal(
    entrada.assunto,
    entrada.nomesProibidosNoAssunto,
  );

  const fetchImpl = opcoes.fetchImpl ?? fetch;
  const endpoint = opcoes.endpoint ?? ENDPOINT_PADRAO;

  const resposta = await fetchImpl(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${opcoes.apiKey}`,
    },
    body: JSON.stringify({
      from: entrada.de,
      to: entrada.para,
      subject: entrada.assunto,
      html: entrada.corpoHtml,
      attachments: entrada.anexos?.map((anexo) => ({
        filename: anexo.nomeArquivo,
        content: paraBase64(anexo.conteudo),
        content_type: anexo.tipoConteudo,
      })),
    }),
  });

  if (!resposta.ok) {
    throw new Error(
      `Resend: resposta HTTP ${resposta.status} ao enviar e-mail`,
    );
  }

  const json = (await resposta.json()) as { id: string };
  return { id: json.id };
}
