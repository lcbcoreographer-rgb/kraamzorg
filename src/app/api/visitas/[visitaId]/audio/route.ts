import { NextResponse } from "next/server";
import { z } from "zod";
import { obterSessao } from "@/lib/auth/sessao";
import { obterRepositorios } from "@/lib/dados/fabrica";
import { ErroRepositorio } from "@/lib/dados/erros";
import { codigoChecklist, fraseDoErro } from "@/lib/checklist/erros";
import {
  caminhoDoAudio,
  conferirAudio,
  extensaoDoTipo,
  tipoBase,
} from "@/lib/checklist/audio";
import { criarArmazenamentoAudio } from "@/lib/checklist/armazenamento-audio";

export const runtime = "nodejs";

/**
 * `POST /api/visitas/[visitaId]/audio` (P39 item 6): anexa um áudio à visita.
 * A sessão precisa ser da profissional da visita (ou da coordenação) em
 * AAL2; quem confere isso é o banco, por `api.registrar_anexo_audio`, e o
 * checklist da visita (que a RLS só devolve a quem pode ver). Tipo,
 * tamanho e duração vêm do parâmetro `audio_visita`. O arquivo vai para o
 * storage privado em `visitas/<visita>/<arquivo>`, sem nome de paciente. A
 * transcrição fica desligada (parâmetro `transcricao_audio_ativa`, L-04).
 */
const idSchema = z.uuid();

export async function POST(
  request: Request,
  contexto: { params: Promise<{ visitaId: string }> },
) {
  const { visitaId } = await contexto.params;
  if (!idSchema.safeParse(visitaId).success) {
    return NextResponse.json({ erro: "visita inválida" }, { status: 400 });
  }

  const sessao = await obterSessao();
  if (!sessao || !sessao.ativo || sessao.papeis.length === 0) {
    return NextResponse.json(
      { erro: "Sem sessão. Entre de novo e tente outra vez." },
      { status: 401 },
    );
  }
  if (sessao.aal !== "aal2") {
    return NextResponse.json(
      { erro: "Confirme o código do aplicativo (MFA) e tente de novo." },
      { status: 403 },
    );
  }

  let formulario: FormData;
  try {
    formulario = await request.formData();
  } catch {
    return NextResponse.json({ erro: "envio inválido" }, { status: 400 });
  }
  const arquivo = formulario.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return NextResponse.json(
      { erro: "falta o arquivo de áudio" },
      { status: 400 },
    );
  }
  const duracaoBruta = Number(formulario.get("duracao"));
  const duracaoSeg =
    Number.isFinite(duracaoBruta) && duracaoBruta > 0
      ? Math.round(duracaoBruta)
      : null;

  try {
    const { assistencial } = await obterRepositorios();
    const checklist = await assistencial.obterChecklist(visitaId);
    if (!checklist) {
      return NextResponse.json(
        { erro: "visita não encontrada" },
        { status: 404 },
      );
    }
    const problema = conferirAudio(checklist.parametros.audio, {
      tipo: arquivo.type,
      tamanhoBytes: arquivo.size,
      duracaoSeg,
    });
    const extensao = extensaoDoTipo(arquivo.type);
    if (problema || !extensao) {
      return NextResponse.json(
        {
          erro:
            problema === "tipo" || !extensao
              ? "tipo_nao_aceito"
              : "audio_longo",
        },
        { status: 422 },
      );
    }

    const caminho = caminhoDoAudio(visitaId, crypto.randomUUID(), extensao);
    const armazenamento = await criarArmazenamentoAudio();
    await armazenamento.guardar(
      caminho,
      new Uint8Array(await arquivo.arrayBuffer()),
      tipoBase(arquivo.type),
    );
    const { id } = await assistencial.registrarAudio(
      visitaId,
      caminho,
      duracaoSeg,
    );
    return NextResponse.json({ id, status: "pendente" });
  } catch (erro) {
    if (erro instanceof ErroRepositorio && erro.codigo === "sem_permissao") {
      return NextResponse.json({ erro: "sem permissão" }, { status: 403 });
    }
    return NextResponse.json(
      { erro: codigoChecklist(erro) ?? fraseDoErro(erro, "anexar o áudio") },
      { status: 500 },
    );
  }
}
