import { abrirPdfEvolucao } from "@/modules/assistencial/evolucao/pdf-rota";

export const runtime = "nodejs";

/** PDF da evolução para a enfermeira (P41): só dos acompanhamentos dela, conferido pelo banco. */
export async function GET(
  request: Request,
  context: { params: Promise<{ acompanhamentoId: string; documento: string }> },
): Promise<Response> {
  const { acompanhamentoId, documento } = await context.params;
  const previa = new URL(request.url).searchParams.get("previa") === "1";
  return abrirPdfEvolucao(acompanhamentoId, documento, previa);
}
