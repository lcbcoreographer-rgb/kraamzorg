import { NextResponse } from "next/server";
import { z } from "zod";
import { obterSessao } from "@/lib/auth/sessao";
import { obterRepositorios } from "@/lib/dados/fabrica";
import { ErroRepositorio } from "@/lib/dados/erros";
import { criarArmazenamentoAudio } from "@/lib/checklist/armazenamento-audio";

export const runtime = "nodejs";

/**
 * `GET /api/visitas/[visitaId]/audio/[audioId]` (P39 item 6): devolve a URL
 * assinada para ouvir o áudio. O banco confere papel, AAL2 e família
 * (`api.audio_da_visita_para_ouvir`) e grava a leitura no log; a URL vale o
 * que diz o parâmetro `audio_url_assinada_segundos` (60 s). Nunca em cache.
 */
const idSchema = z.uuid();

export async function GET(
  _request: Request,
  contexto: { params: Promise<{ visitaId: string; audioId: string }> },
) {
  const { visitaId, audioId } = await contexto.params;
  if (
    !idSchema.safeParse(visitaId).success ||
    !idSchema.safeParse(audioId).success
  ) {
    return NextResponse.json({ erro: "pedido inválido" }, { status: 400 });
  }
  const sessao = await obterSessao();
  if (!sessao || !sessao.ativo || sessao.papeis.length === 0) {
    return NextResponse.json({ erro: "Sem sessão." }, { status: 401 });
  }
  if (sessao.aal !== "aal2") {
    return NextResponse.json(
      { erro: "Confirme o código do aplicativo (MFA)." },
      { status: 403 },
    );
  }

  try {
    const { assistencial } = await obterRepositorios();
    const { arquivoPath, validadeSeg } =
      await assistencial.audioParaOuvir(audioId);
    // O áudio precisa ser desta visita: o caminho leva o id dela.
    if (!arquivoPath.startsWith(`visitas/${visitaId}/`)) {
      return NextResponse.json({ erro: "não encontrado" }, { status: 404 });
    }
    const armazenamento = await criarArmazenamentoAudio();
    const url = await armazenamento.urlAssinada(arquivoPath, validadeSeg);
    return NextResponse.json(
      { url, validadeSeg },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (erro) {
    if (erro instanceof ErroRepositorio && erro.codigo === "sem_permissao") {
      return NextResponse.json({ erro: "sem permissão" }, { status: 403 });
    }
    return NextResponse.json(
      { erro: "não foi possível abrir o áudio" },
      { status: 500 },
    );
  }
}
