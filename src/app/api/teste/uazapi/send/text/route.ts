import { NextResponse } from "next/server";
import { ehHomologacao, respostaForaDeHomologacao } from "../../_lib/guarda";
import { obterLojaTesteUazapi } from "../../_lib/loja";

/**
 * Captura de `POST /send/text` (corpo `{number, text, delay?,
 * track_source}`, `n8n/src/lib/uazapi.mjs`, `corpoEnvioTexto`). Devolve um
 * formato parecido com a UAZAPI real, só o suficiente para o fluxo seguir
 * sem erro (`id` da mensagem simulada).
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
  if (typeof corpo.number !== "string" || typeof corpo.text !== "string") {
    return NextResponse.json(
      {
        erro: "Corpo precisa de 'number' e 'text' (formato do /send/text da UAZAPI).",
      },
      { status: 400 },
    );
  }

  const id = crypto.randomUUID();
  obterLojaTesteUazapi().envios.push({
    id,
    tipo: "texto",
    corpo,
    capturadoEm: new Date().toISOString(),
  });

  return NextResponse.json({ id, status: "sent" });
}
