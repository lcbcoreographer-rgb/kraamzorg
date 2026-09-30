import { NextResponse } from "next/server";
import { z } from "zod";
import { obterSessao } from "@/lib/auth/sessao";
import { ErroRepositorio } from "@/lib/dados/erros";
import { obterRepositorioInscricaoPush } from "@/modules/mensageria/push/repositorio";

export const runtime = "nodejs";

/**
 * Inscrição de Web Push do aparelho da pessoa logada (P11 item 4).
 *
 * `POST` guarda (ou atualiza) a inscrição; `DELETE` a tira (ao desligar o
 * aviso ou ao sair). Só com sessão: quem chama é a própria pessoa, pelo
 * navegador. O banco decide papel e AAL dentro de
 * `api.registrar_inscricao_push` e `api.remover_inscricao_push`, e cada um
 * só mexe na inscrição de si mesmo. A resposta nunca repete endpoint nem
 * chaves.
 */
const inscricaoSchema = z.object({
  endpoint: z
    .string()
    .max(2048)
    .refine(
      (v) => v.startsWith("https://"),
      "o endereço do aviso precisa ser https",
    ),
  chaves: z.object({
    p256dh: z.string().min(1).max(512),
    auth: z.string().min(1).max(512),
  }),
});

const remocaoSchema = z.object({ endpoint: z.string().min(1).max(2048) });

async function sessaoDaChamada() {
  const sessao = await obterSessao();
  if (!sessao || !sessao.ativo || sessao.papeis.length === 0) return null;
  return sessao;
}

function resposta(erro: unknown): NextResponse {
  if (erro instanceof ErroRepositorio && erro.codigo === "sem_permissao") {
    return NextResponse.json(
      { erro: "Confirme o código do aplicativo (MFA) e tente de novo." },
      { status: 403 },
    );
  }
  return NextResponse.json(
    { erro: "Não foi possível guardar o aviso deste aparelho. Tente de novo." },
    { status: 500 },
  );
}

export async function POST(request: Request) {
  const sessao = await sessaoDaChamada();
  if (!sessao) {
    return NextResponse.json(
      { erro: "Sem sessão. Entre de novo." },
      { status: 401 },
    );
  }
  const validado = inscricaoSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!validado.success) {
    return NextResponse.json({ erro: "Inscrição inválida." }, { status: 400 });
  }
  try {
    await obterRepositorioInscricaoPush().registrar(
      sessao.usuarioId,
      validado.data,
    );
    return NextResponse.json({ ok: true });
  } catch (erro) {
    return resposta(erro);
  }
}

export async function DELETE(request: Request) {
  const sessao = await sessaoDaChamada();
  if (!sessao) {
    return NextResponse.json(
      { erro: "Sem sessão. Entre de novo." },
      { status: 401 },
    );
  }
  const validado = remocaoSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!validado.success) {
    return NextResponse.json({ erro: "Pedido inválido." }, { status: 400 });
  }
  try {
    await obterRepositorioInscricaoPush().remover(
      sessao.usuarioId,
      validado.data.endpoint,
    );
    return NextResponse.json({ ok: true });
  } catch (erro) {
    return resposta(erro);
  }
}
