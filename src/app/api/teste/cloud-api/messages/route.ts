import { NextResponse } from "next/server";
import { registrarCaptura } from "@/lib/messaging/captura";
import {
  ehHomologacao,
  respostaForaDeHomologacao,
} from "../../uazapi/_lib/guarda";

/**
 * Captura de `POST /messages` da Cloud API (P18b): com
 * `homologacao.envioSimulado`, o nó "Enviar Modelo Aprovado (Cloud API)" do
 * fluxo 3 (`n8n/src/lib/cloud-api.mjs`) manda para cá, sem credencial, o
 * mesmo corpo que iria para a Meta. Responde no formato da Cloud API, com um
 * wamid de teste. Só existe em homologação; fora dela recusa com 403 e nada
 * é capturado (como a captura da UAZAPI).
 */
export async function POST(requisicao: Request) {
  if (!ehHomologacao()) {
    return respostaForaDeHomologacao();
  }

  let corpo: Record<string, unknown>;
  try {
    corpo = (await requisicao.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { erro: "Corpo inválido: esperado JSON." },
      { status: 400 },
    );
  }
  if (corpo.messaging_product !== "whatsapp" || typeof corpo.to !== "string") {
    return NextResponse.json(
      {
        erro: "Corpo precisa de messaging_product 'whatsapp' e 'to' (formato do POST /messages da Cloud API).",
      },
      { status: 400 },
    );
  }

  const id = registrarCaptura(corpo);
  return NextResponse.json({
    messaging_product: "whatsapp",
    contacts: [{ input: corpo.to, wa_id: corpo.to }],
    messages: [{ id: `wamid.TESTE.${id}` }],
  });
}
