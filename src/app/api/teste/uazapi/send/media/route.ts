import { NextResponse } from "next/server";
import { ehHomologacao, respostaForaDeHomologacao } from "../../_lib/guarda";
import { obterLojaTesteUazapi } from "../../_lib/loja";

/**
 * Captura de `POST /send/media` (corpo `{number, type, file, docName?,
 * track_source}`, `n8n/src/lib/uazapi.mjs`, `corpoEnvioDocumento`): a
 * apresentação (PDF) e qualquer outro arquivo que o fluxo mande.
 */
export async function POST(requisicao: Request) {
  if (!ehHomologacao()) return respostaForaDeHomologacao();

  let corpo: Record<string, unknown>;
  try {
    corpo = (await requisicao.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { erro: "Corpo inválido: esperado JSON." },
      { status: 400 },
    );
  }
  if (typeof corpo.number !== "string") {
    return NextResponse.json(
      { erro: "Corpo precisa de 'number' (formato do /send/media da UAZAPI)." },
      { status: 400 },
    );
  }

  const id = crypto.randomUUID();
  obterLojaTesteUazapi().envios.push({
    id,
    tipo: "midia",
    corpo,
    capturadoEm: new Date().toISOString(),
  });

  return NextResponse.json({ id, status: "sent" });
}
