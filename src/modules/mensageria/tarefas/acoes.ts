"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigirSessao } from "@/lib/auth/sessao";
import { ErroRepositorio } from "@/lib/dados/erros";
import { obterRepositorios } from "@/lib/dados/fabrica";
import { obterTarefaAberta } from "./dados";
import { prepararEnvioTarefa } from "./enviar-tarefa";
import type { EstadoAcaoTarefa } from "./estado-acoes";
import { registrarEnvioTarefa } from "./registrar-envio";
import { categoriaDaTarefa } from "./tipos";

function mensagemErro(erro: unknown): string {
  if (erro instanceof ErroRepositorio) {
    if (erro.codigo === "sem_permissao") {
      return "Essa tarefa não é sua. Atualize a tela.";
    }
    if (erro.codigo === "nao_encontrado") {
      return "Essa tarefa não existe mais. Atualize a tela.";
    }
    if (erro.codigo === "funcao_pendente") {
      return "O registro do envio ainda não está pronto no banco. Nada foi alterado; avise a equipe técnica.";
    }
  }
  return "Não foi possível agora. Tente de novo em instantes.";
}

const campoTarefaId = z.string().min(1, "Falta saber qual tarefa é essa.");

/**
 * "Enviei" (PRD 23.2, item 2 do P18). Do formulário só vêm o id da tarefa
 * e o texto que a pessoa editou; família, telefone e categoria são lidos de
 * novo da tarefa no servidor (`obterTarefaAberta`, com RLS). Confere o
 * freio outra vez (pode ter mudado desde que a tela carregou), grava a
 * mensagem com `enviado_por = humano` e conclui a tarefa. Recusa se o freio
 * bloquear agora, mesmo que o botão tenha aparecido na renderização
 * anterior.
 */
export async function enviarTarefa(
  _anterior: EstadoAcaoTarefa,
  formulario: FormData,
): Promise<EstadoAcaoTarefa> {
  await exigirSessao("/tarefas");

  const dados = z
    .object({
      tarefaId: campoTarefaId,
      texto: z
        .string()
        .trim()
        .min(1, "Escreva o texto antes de marcar como enviado."),
    })
    .safeParse({
      tarefaId: formulario.get("tarefaId"),
      texto: formulario.get("texto"),
    });
  if (!dados.success) {
    return {
      erro:
        dados.error.issues[0]?.message ?? "Confira os dados e tente de novo.",
    };
  }

  try {
    const tarefa = await obterTarefaAberta(dados.data.tarefaId);
    if (!tarefa) {
      return {
        erro: "Essa tarefa não está mais aberta para você. Atualize a tela.",
      };
    }
    if (!tarefa.temAcaoWhatsApp || !tarefa.mensagem.telefoneE164) {
      return {
        erro: "Essa tarefa não tem mensagem para a família. Use Concluir.",
      };
    }

    const resultado = await prepararEnvioTarefa({
      familiaId: tarefa.familiaId,
      telefoneE164: tarefa.mensagem.telefoneE164,
      texto: dados.data.texto,
      categoria: categoriaDaTarefa(tarefa.mensagem),
    });
    if (!resultado.ok) {
      return { erro: resultado.motivo };
    }
    await registrarEnvioTarefa({
      tarefaId: tarefa.id,
      familiaId: tarefa.familiaId,
      textoEnviado: dados.data.texto,
    });
  } catch (erro) {
    return { erro: mensagemErro(erro) };
  }

  revalidatePath("/tarefas");
  return { sucesso: "Envio registrado. A tarefa saiu da sua lista." };
}

/** Concluir sem WhatsApp (tarefa interna, como "Justificar o freio" já resolvida por outro caminho). */
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
