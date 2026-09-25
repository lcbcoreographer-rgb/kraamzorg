import { NextResponse } from "next/server";
import { ehHomologacao, respostaForaDeHomologacao } from "../../_lib/guarda";
import { obterLojaTesteUazapi } from "../../_lib/loja";

/**
 * Captura de `POST /message/download` (download e transcrição de áudio,
 * `n8n/src/lib/uazapi.mjs`): com `homologacao.transcricaoSimulada`, devolve
 * o texto que o teste registrou antes em `POST /api/teste/uazapi/transcricoes`
 * para o id da mensagem, ou falha de propósito quando o teste pediu isso
 * (caso "áudio com a transcrição forçada a falhar", PRD Apêndice C). Sem
 * registro prévio, devolve um texto neutro, para não travar um caso de
 * teste que ainda não define a transcrição.
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
  const id =
    typeof corpo.id === "string"
      ? corpo.id
      : typeof corpo.messageid === "string"
        ? corpo.messageid
        : null;
  if (!id) {
    return NextResponse.json(
      {
        erro: "Corpo precisa de 'id' ou 'messageid' (formato do /message/download da UAZAPI).",
      },
      { status: 400 },
    );
  }

  const espera = obterLojaTesteUazapi().transcricoes[id];
  if (espera?.falhar) {
    return NextResponse.json(
      { erro: "Transcrição forçada a falhar pelo teste." },
      { status: 502 },
    );
  }

  return NextResponse.json({
    transcricao:
      espera?.texto ?? "(nenhuma transcrição registrada para este teste)",
  });
}
