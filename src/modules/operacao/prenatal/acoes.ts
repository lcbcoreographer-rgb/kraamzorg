"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigirSessao } from "@/lib/auth/sessao";
import { obterRepositorios } from "@/lib/dados/fabrica";
import type { EstadoAcaoOperacao } from "../comum/estado-acoes";
import { fraseErroOperacao } from "../comum/mensagens";

// Só funções assíncronas saem daqui ("use server"); estado e tipos em
// ../comum/estado-acoes.ts.

/**
 * Data e hora digitadas no fuso de Brasília (sem horário de verão desde
 * 2019, então o deslocamento é fixo em -03:00) para o instante ISO.
 */
function instanteBrasilia(data: string, hora: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || !/^\d{2}:\d{2}$/.test(hora)) {
    return null;
  }
  const instante = new Date(`${data}T${hora}:00-03:00`);
  return Number.isNaN(instante.getTime()) ? null : instante.toISOString();
}

function texto(formulario: FormData, campo: string): string {
  const valor = formulario.get(campo);
  return typeof valor === "string" ? valor.trim() : "";
}

function revalidarPrenatal(familiaId?: string) {
  revalidatePath("/prenatal");
  if (familiaId) {
    revalidatePath(`/prenatal/${familiaId}`);
    revalidatePath(`/radar/${familiaId}`);
    revalidatePath(`/familias/${familiaId}`);
  }
  revalidatePath("/radar");
  revalidatePath("/tarefas");
  revalidatePath("/pipeline");
}

const esquemaAgendar = z.object({
  familiaId: z.uuid(),
  data: z.string().min(1, "Escolha o dia da consulta."),
  hora: z.string().min(1, "Escolha o horário da consulta."),
});

/**
 * Marca (ou remarca) a consulta pré-natal (P35 itens 1 e 5). O banco leva o
 * P2 a "Consulta pré-natal agendada" na primeira vez e conclui a tarefa
 * agendar_prenatal.
 */
export async function acaoAgendarConsulta(
  _anterior: EstadoAcaoOperacao,
  formulario: FormData,
): Promise<EstadoAcaoOperacao> {
  await exigirSessao("/prenatal");
  const dados = esquemaAgendar.safeParse({
    familiaId: texto(formulario, "familiaId"),
    data: texto(formulario, "data"),
    hora: texto(formulario, "hora"),
  });
  if (!dados.success) {
    const campos: Record<string, string> = {};
    for (const problema of dados.error.issues) {
      const campo = String(problema.path[0] ?? "");
      campos[campo] ??= problema.message;
    }
    return { erro: "Falta um dado para marcar a consulta.", campos };
  }
  const agendadaPara = instanteBrasilia(dados.data.data, dados.data.hora);
  if (!agendadaPara) {
    return {
      erro: "Falta um dado para marcar a consulta.",
      campos: { data: "Confira o dia e o horário." },
    };
  }

  try {
    const { operacao } = await obterRepositorios();
    await operacao.agendarConsulta({
      familiaId: dados.data.familiaId,
      agendadaPara,
    });
  } catch (erro) {
    return { erro: fraseErroOperacao(erro, "marcar a consulta") };
  }

  revalidarPrenatal(dados.data.familiaId);
  return { sucesso: "Consulta marcada." };
}

/**
 * Conclui a entrevista (P35 item 5). A tela só chama depois de esvaziar a
 * fila do aparelho: concluída, resposta nova exige motivo.
 */
export async function acaoConcluirEntrevista(
  consultaId: string,
  familiaId: string,
): Promise<EstadoAcaoOperacao> {
  await exigirSessao("/prenatal");
  if (!z.uuid().safeParse(consultaId).success) {
    return { erro: "Não achei essa consulta. Atualize a tela." };
  }
  try {
    const { operacao } = await obterRepositorios();
    await operacao.concluirEntrevista(consultaId);
  } catch (erro) {
    return { erro: fraseErroOperacao(erro, "concluir a entrevista") };
  }
  revalidarPrenatal(familiaId);
  return { sucesso: "Entrevista concluída." };
}
