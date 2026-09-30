import "server-only";
import { z } from "zod";
import { obterArmazenamento, SEGUNDOS_URL_ASSINADA } from "@/lib/armazenamento";
import { obterSessao } from "@/lib/auth/sessao";
import { obterRepositorios } from "@/lib/dados/fabrica";

/**
 * Abre o PDF ou o XML de uma nota (P43) para o financeiro e a diretoria, em
 * AAL2. A permissão vem do banco (`api.arquivo_da_nota`, que registra a
 * abertura no log); o arquivo está no storage privado e a URL é assinada por
 * 60 segundos (na demonstração os bytes saem daqui). Nunca em cache; o nome do
 * arquivo é o id da nota.
 */
const CABECALHOS = {
  "Cache-Control": "no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
} as const;

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string; tipo: string }> },
): Promise<Response> {
  const { id, tipo } = await context.params;
  if (!z.uuid().safeParse(id).success || (tipo !== "pdf" && tipo !== "xml")) {
    return new Response("Não encontrado.", { status: 404 });
  }
  const sessao = await obterSessao();
  if (!sessao) return new Response("Entre para abrir a nota.", { status: 401 });
  if (sessao.aal !== "aal2") {
    return new Response("Confirme o código do aplicativo para abrir a nota.", {
      status: 403,
    });
  }

  let caminho: string;
  try {
    const { notas } = await obterRepositorios();
    caminho = await notas.caminhoArquivo(id, tipo);
  } catch (erro) {
    const semArquivo =
      erro instanceof Error && /sem_arquivo/.test(erro.message);
    return new Response(
      semArquivo
        ? "Esta nota não tem esse arquivo guardado."
        : "Sem permissão para abrir este arquivo.",
      { status: semArquivo ? 404 : 403 },
    );
  }

  const arquivo = await obterArmazenamento().abrir(
    caminho,
    SEGUNDOS_URL_ASSINADA,
  );
  if (!arquivo)
    return new Response("O arquivo não foi encontrado.", { status: 404 });
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
      "Content-Disposition": `inline; filename="nota-${id}.${tipo}"`,
    },
  });
}
