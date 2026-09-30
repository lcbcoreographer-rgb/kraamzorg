import { NextResponse } from "next/server";
import { limparCapturas, listarCapturas } from "@/lib/messaging/captura";
import {
  controleAutorizado,
  ehHomologacao,
  respostaSemSegredo,
} from "../uazapi/_lib/guarda";

/**
 * Painel de conferência da captura da Cloud API (P18b): sem credencial da
 * Meta, o adaptador `cloud_api` guarda em memória o que enviaria (texto livre
 * dentro da janela, modelo aprovado fora dela). O roteiro de homologação lê
 * aqui o modelo escolhido e os parâmetros, sem número real. Existe só em
 * homologação e exige o segredo das rotas internas, como a captura da
 * UAZAPI.
 */
function foraDeHomologacao(): NextResponse {
  return NextResponse.json(
    {
      erro: "A captura da Cloud API só existe em homologação (NEXT_PUBLIC_APP_ENV=homologacao). Nada foi lido nem gravado.",
    },
    { status: 403 },
  );
}

export async function GET(requisicao: Request) {
  if (!ehHomologacao()) return foraDeHomologacao();
  if (!controleAutorizado(requisicao)) return respostaSemSegredo();
  return NextResponse.json({ envios: listarCapturas() });
}

export async function DELETE(requisicao: Request) {
  if (!ehHomologacao()) return foraDeHomologacao();
  if (!controleAutorizado(requisicao)) return respostaSemSegredo();
  limparCapturas();
  return NextResponse.json({ ok: true });
}
