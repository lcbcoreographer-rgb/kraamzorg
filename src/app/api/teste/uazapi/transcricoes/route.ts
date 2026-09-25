import { NextResponse } from "next/server";
import {
  controleAutorizado,
  ehHomologacao,
  respostaForaDeHomologacao,
  respostaSemSegredo,
} from "../_lib/guarda";
import { obterLojaTesteUazapi } from "../_lib/loja";

/**
 * Controle do roteiro de homologação (P28) sobre `message/download`: antes
 * de mandar o payload de áudio ao webhook do fluxo 3, o teste registra
 * aqui `{id, texto}` (o que a transcrição simulada deve devolver) ou
 * `{id, falhar: true}` (para o caso de transcrição que falha). Exige o
 * segredo das rotas internas (`_lib/guarda.ts`).
 */
export async function POST(requisicao: Request) {
  if (!ehHomologacao()) return respostaForaDeHomologacao();
  if (!controleAutorizado(requisicao)) return respostaSemSegredo();

  let corpo: Record<string, unknown>;
  try {
    corpo = (await requisicao.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { erro: "Corpo inválido: esperado JSON." },
      { status: 400 },
    );
  }
  if (typeof corpo.id !== "string" || !corpo.id) {
    return NextResponse.json(
      { erro: "Corpo precisa de 'id'." },
      { status: 400 },
    );
  }

  obterLojaTesteUazapi().transcricoes[corpo.id] = {
    texto: typeof corpo.texto === "string" ? corpo.texto : null,
    falhar: corpo.falhar === true,
  };
  return NextResponse.json({ ok: true });
}
