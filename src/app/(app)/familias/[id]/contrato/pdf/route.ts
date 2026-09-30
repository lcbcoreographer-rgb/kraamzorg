import "server-only";
import { z } from "zod";
import {
  caminhoContrato,
  obterArmazenamento,
  SEGUNDOS_URL_ASSINADA,
} from "@/lib/armazenamento";
import { obterSessao } from "@/lib/auth/sessao";
import { obterRepositorios } from "@/lib/dados/fabrica";

/**
 * Abre o PDF do contrato para quem tem permissão (P31 item 2): comercial,
 * financeiro (só com contrato) e diretoria, em AAL2. A permissão vem do
 * banco (`api.contrato_situacao`), o arquivo do storage privado e a URL é
 * assinada por 60 segundos; na demonstração os bytes saem daqui mesmo. O
 * nome do arquivo é o id do contrato. Nunca em cache.
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
  if (!sessao)
    return new Response("Entre para abrir o contrato.", { status: 401 });
  if (sessao.aal !== "aal2") {
    return new Response(
      "Confirme o código do aplicativo para abrir o contrato.",
      {
        status: 403,
      },
    );
  }

  let contratoId: string;
  let assinado: boolean;
  try {
    const { contratos } = await obterRepositorios();
    const situacao = await contratos.obterSituacao(id);
    if (!situacao.contrato?.pdfGerado) {
      return new Response("O contrato ainda não foi gerado.", { status: 404 });
    }
    contratoId = situacao.contrato.id;
    assinado = situacao.contrato.status === "assinado";
  } catch {
    return new Response("Sem permissão para abrir este contrato.", {
      status: 403,
    });
  }

  const arquivo = await obterArmazenamento().abrir(
    caminhoContrato(contratoId, assinado),
    SEGUNDOS_URL_ASSINADA,
  );
  // Assinado sem o PDF assinado guardado (a equipe foi avisada): abre o original.
  const escolhido =
    arquivo ??
    (assinado
      ? await obterArmazenamento().abrir(
          caminhoContrato(contratoId, false),
          SEGUNDOS_URL_ASSINADA,
        )
      : null);
  if (!escolhido) {
    return new Response("O arquivo não foi encontrado.", { status: 404 });
  }
  if (escolhido.tipo === "url") {
    return new Response(null, {
      status: 302,
      headers: { ...CABECALHOS, Location: escolhido.url },
    });
  }
  return new Response(new Uint8Array(escolhido.bytes), {
    status: 200,
    headers: {
      ...CABECALHOS,
      "Content-Type": escolhido.contentType,
      "Content-Disposition": `inline; filename="${contratoId}.pdf"`,
    },
  });
}
