"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigirSessao } from "@/lib/auth/sessao";
import { obterRepositorioModulo } from "../dados";
import { traduzirErroPadrao, type EstadoFormulario } from "./comum";

export type { EstadoFormulario } from "./comum";

const ACOES = ["handoff_saude", "bloqueio_total"] as const;

const esquema = z.object({
  id: z.string().optional(),
  termo: z.string().min(1, "Digite o termo."),
  acao: z.enum(ACOES),
  mensagemChave: z.string().min(1, "Escolha a mensagem enviada com o alerta."),
  ativo: z.enum(["true", "false"]),
});

/**
 * Cria ou atualiza um termo de alerta (coordenação clínica, PRD 13,
 * onboarding 9.6): ativar, desativar, ação e mensagem, como o prompt do
 * P13 pede.
 */
export async function salvarTermoAlertaAction(
  _anterior: EstadoFormulario,
  formulario: FormData,
): Promise<EstadoFormulario> {
  await exigirSessao("/configuracoes");
  const entrada = esquema.safeParse({
    id: formulario.get("id") || undefined,
    termo: formulario.get("termo"),
    acao: formulario.get("acao"),
    mensagemChave: formulario.get("mensagemChave"),
    ativo: formulario.get("ativo") ?? "true",
  });
  if (!entrada.success) {
    return {
      erro:
        entrada.error.issues[0]?.message ??
        "Confira os campos e tente de novo.",
    };
  }

  const dados = {
    termo: entrada.data.termo.trim().toLowerCase(),
    acao: entrada.data.acao,
    mensagemChave: entrada.data.mensagemChave,
    ativo: entrada.data.ativo === "true",
  };

  try {
    const repositorio = await obterRepositorioModulo();
    if (entrada.data.id) {
      await repositorio.atualizarTermoAlerta(entrada.data.id, dados);
    } else {
      await repositorio.criarTermoAlerta(dados);
    }
  } catch (erro) {
    return { erro: traduzirErroPadrao(erro, "A coordenação ou a diretoria") };
  }

  revalidatePath("/configuracoes");
  return { sucesso: "Termo de alerta salvo." };
}

const esquemaAlternar = z.object({
  id: z.string().min(1),
  ativo: z.enum(["true", "false"]),
});

export async function alternarTermoAlertaAction(
  _anterior: EstadoFormulario,
  formulario: FormData,
): Promise<EstadoFormulario> {
  await exigirSessao("/configuracoes");
  const entrada = esquemaAlternar.safeParse({
    id: formulario.get("id"),
    ativo: formulario.get("ativo"),
  });
  if (!entrada.success) return { erro: "Não deu para ler o formulário." };

  try {
    const repositorio = await obterRepositorioModulo();
    await repositorio.atualizarTermoAlerta(entrada.data.id, {
      ativo: entrada.data.ativo === "true",
    });
  } catch (erro) {
    return { erro: traduzirErroPadrao(erro, "A coordenação ou a diretoria") };
  }

  revalidatePath("/configuracoes");
  return {
    sucesso:
      entrada.data.ativo === "true" ? "Termo ativado." : "Termo desativado.",
  };
}
