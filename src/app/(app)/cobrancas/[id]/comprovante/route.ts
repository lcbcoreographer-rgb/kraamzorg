import "server-only";
import { z } from "zod";
import { obterArmazenamento, SEGUNDOS_URL_ASSINADA } from "@/lib/armazenamento";
import { obterSessao } from "@/lib/auth/sessao";
import { obterRepositorios } from "@/lib/dados/fabrica";

/**
 * Abre o comprovante da baixa manual (P32 item 4) para o financeiro e a
 * diretoria, em AAL2. A permissão vem do banco (`api.cobranca`); o arquivo
 * está no storage privado e a URL é assinada por 60 segundos (na
 * demonstração os bytes saem daqui). Nunca em cache.
 */
const CABECALHOS = {
  "Cache-Control": "no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
} as const;

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) {
    return new Response("Não encontrado.", { status: 404 });
  }
  const sessao = await obterSessao();
  if (!sessao) {
    return new Response("Entre para abrir o comprovante.", { status: 401 });
  }
  if (sessao.aal !== "aal2") {
    return new Response(
      "Confirme o código do aplicativo para abrir o comprovante.",
      { status: 403 },
    );
  }

  let caminho: string | null;
  try {
    const { cobrancas } = await obterRepositorios();
    caminho = (await cobrancas.obter(id)).comprovantePath;
  } catch {
    return new Response("Sem permissão para abrir este comprovante.", {
      status: 403,
    });
  }
  if (!caminho) {
    return new Response("Esta cobrança não tem comprovante anexado.", {
      status: 404,
    });
  }

  const arquivo = await obterArmazenamento().abrir(
    caminho,
    SEGUNDOS_URL_ASSINADA,
  );
  if (!arquivo) {
    return new Response("O arquivo não foi encontrado.", { status: 404 });
  }
  if (arquivo.tipo === "url") {
    return new Response(null, {
      status: 302,
      headers: { ...CABECALHOS, Location: arquivo.url },
    });
  }
  return new Response(new Uint8Array(arquivo.bytes), {
    status: 200,
    headers: {
      ...CABECALHOS,
      "Content-Type": arquivo.contentType,
      // Nome pelo id da cobrança, nunca pelo de quem enviou o arquivo.
      "Content-Disposition": `inline; filename="comprovante-${id}"`,
    },
  });
}
