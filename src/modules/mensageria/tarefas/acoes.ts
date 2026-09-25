"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigirSessao } from "@/lib/auth/sessao";
import { ErroRepositorio } from "@/lib/dados/erros";
import { obterRepositorios } from "@/lib/dados/fabrica";
import { confirmarEnvioTarefa, prepararEnvioTarefa } from "./enviar-tarefa";

export interface EstadoAcaoTarefa {
  erro?: string;
  sucesso?: string;
}

export const estadoInicialTarefa: EstadoAcaoTarefa = {};

function mensagemErro(erro: unknown): string {
  if (erro instanceof ErroRepositorio) {
    if (erro.codigo === "sem_permissao") {
      return "Essa tarefa não é sua. Atualize a tela.";
    }
    if (erro.codigo === "nao_encontrado") {
      return "Essa tarefa não existe mais. Atualize a tela.";
    }
    if (erro.codigo === "funcao_pendente") {
      return "O banco ainda não tem essa função. Avise a equipe técnica; nada foi alterado.";
    }
  }
  return "Não foi possível agora. Tente de novo em instantes.";
}

const campoTarefaId = z.string().min(1, "Falta saber qual tarefa é essa.");

/**
 * "Enviei" (PRD 23.2, item 2 do P18): confere o freio de novo (pode ter
 * mudado desde que a tela carregou), grava a mensagem com `enviado_por =
 * humano` e conclui a tarefa. Recusa se o freio bloquear agora, mesmo que
 * o botão tenha aparecido habilitado na renderização anterior.
 */
export async function enviarTarefa(
  _anterior: EstadoAcaoTarefa,
  formulario: FormData,
): Promise<EstadoAcaoTarefa> {
  await exigirSessao("/tarefas");

  const dados = z
    .object({
      tarefaId: campoTarefaId,
      familiaId: z.string().min(1).nullable(),
      telefoneE164: z.string().min(1),
      texto: z.string().trim().min(1, "Escreva alguma coisa antes de enviar."),
    })
    .safeParse({
      tarefaId: formulario.get("tarefaId"),
      familiaId: formulario.get("familiaId") || null,
      telefoneE164: formulario.get("telefoneE164"),
      texto: formulario.get("texto"),
    });
  if (!dados.success) {
    return { erro: dados.error.issues[0]?.message ?? "Confira os dados e tente de novo." };
  }

  try {
    const resultado = await prepararEnvioTarefa({
      familiaId: dados.data.familiaId,
      telefoneE164: dados.data.telefoneE164,
      texto: dados.data.texto,
    });
    if (!resultado.ok) {
      return { erro: resultado.motivo };
    }
    await confirmarEnvioTarefa({
      tarefaId: dados.data.tarefaId,
      familiaId: dados.data.familiaId,
      telefoneE164: dados.data.telefoneE164,
      texto: dados.data.texto,
    });
  } catch (erro) {
    return { erro: mensagemErro(erro) };
  }

  revalidatePath("/tarefas");
  return { sucesso: "Enviado. A tarefa saiu da sua lista." };
}

/** Concluir sem WhatsApp (tarefa interna, ex.: "Justificar o freio" já resolvida por outro caminho). */
export async function concluirTarefaSemMensagem(
  _anterior: EstadoAcaoTarefa,
  formulario: FormData,
): Promise<EstadoAcaoTarefa> {
  await exigirSessao("/tarefas");
  const tarefaId = campoTarefaId.safeParse(formulario.get("tarefaId"));
  if (!tarefaId.success) {
    return { erro: "Não deu para saber qual tarefa é essa. Tente de novo." };
  }

  try {
    const { tarefas } = await obterRepositorios();
    await tarefas.concluirTarefa(tarefaId.data);
  } catch (erro) {
    return { erro: mensagemErro(erro) };
  }

  revalidatePath("/tarefas");
  return { sucesso: "Tarefa concluída." };
}
