"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigirSessao } from "@/lib/auth/sessao";
import { obterRepositorios } from "@/lib/dados/fabrica";
import {
  fraseErroRelacao,
  type EstadoAcaoRelacao,
} from "@/modules/relacao/frases";

const id = z.uuid();

/** Libera o portal para uma pessoa da família e cria a tarefa do convite (P49). */
export async function acaoLiberarAcesso(
  pessoaId: string,
): Promise<EstadoAcaoRelacao> {
  await exigirSessao("/portal-familia");
  const p = id.safeParse(pessoaId);
  if (!p.success) return { erro: "Atualize a tela e tente de novo." };
  try {
    const { relacao } = await obterRepositorios();
    const r = await relacao.acessoFamilia.liberar(p.data);
    revalidatePath("/portal-familia");
    revalidatePath("/tarefas");
    return {
      sucesso: r.jaLiberado
        ? "O acesso já estava liberado."
        : r.tarefaId
          ? "Acesso liberado. A tarefa com o texto do convite já está em Tarefas, para quem for enviar."
          : "Acesso liberado. Nenhum convite foi criado porque a família não pode receber mensagem agora.",
    };
  } catch (erro) {
    return { erro: fraseErroRelacao(erro, "liberar o acesso") };
  }
}

/** Suspende o acesso; vale na hora (P49). */
export async function acaoSuspenderAcesso(
  pessoaId: string,
): Promise<EstadoAcaoRelacao> {
  await exigirSessao("/portal-familia");
  const p = id.safeParse(pessoaId);
  if (!p.success) return { erro: "Atualize a tela e tente de novo." };
  try {
    const { relacao } = await obterRepositorios();
    await relacao.acessoFamilia.suspender(p.data);
    revalidatePath("/portal-familia");
    return {
      sucesso:
        "Acesso suspenso. A família não abre mais o portal até você liberar de novo.",
    };
  } catch (erro) {
    return { erro: fraseErroRelacao(erro, "suspender o acesso") };
  }
}

const autorizacao = z.object({
  profissionalId: z.uuid(),
  autorizaNome: z.enum(["sim", "nao"]),
  autorizaFoto: z.enum(["sim", "nao"]),
});

/** Registra o que a enfermeira autorizou a família a ver: nome e foto (P49). */
export async function acaoSalvarAutorizacao(
  _anterior: EstadoAcaoRelacao,
  dados: FormData,
): Promise<EstadoAcaoRelacao> {
  await exigirSessao("/portal-familia");
  const lido = autorizacao.safeParse({
    profissionalId: dados.get("profissionalId"),
    autorizaNome: dados.get("autorizaNome") ?? "nao",
    autorizaFoto: dados.get("autorizaFoto") ?? "nao",
  });
  if (!lido.success) return { erro: "Atualize a tela e tente de novo." };
  try {
    const { relacao } = await obterRepositorios();
    await relacao.acessoFamilia.salvarAutorizacao({
      profissionalId: lido.data.profissionalId,
      autorizaNome: lido.data.autorizaNome === "sim",
      autorizaFoto: lido.data.autorizaFoto === "sim",
    });
    revalidatePath("/portal-familia");
    return { sucesso: "Autorização registrada." };
  } catch (erro) {
    return { erro: fraseErroRelacao(erro, "registrar a autorização") };
  }
}
