import { abrirPdfEvolucao } from "@/modules/assistencial/evolucao/pdf-rota";

export const runtime = "nodejs";

/** PDF da evolução (P41): o enviado, por URL assinada curta, ou a prévia com `?previa=1`. */
export async function GET(
  request: Request,
  context: { params: Promise<{ acompanhamentoId: string; documento: string }> },
): Promise<Response> {
  const { acompanhamentoId, documento } = await context.params;
  const previa = new URL(request.url).searchParams.get("previa") === "1";
  return abrirPdfEvolucao(acompanhamentoId, documento, previa);
}
