"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { EstadoAcaoAdmin } from "./estado-acoes";
import { exigirSessao } from "@/lib/auth/sessao";
import { ErroRepositorio } from "@/lib/dados/erros";
import {
  aprovarItemBaseConhecimento,
  salvarItemBaseConhecimento,
} from "./repositorio";

/**
 * Ações da tela `/agente` (P27 item 4): base de conhecimento. [v4.5] O modo
 * do agente, a lista de números de teste e a janela de retomada deixaram de
 * ser ações do app: são parâmetros do agente, mantidos pela equipe de
 * implantação (PRD 6.8 e 13, `parametro.restrito`). `repositorio.ts` confere
 * o papel de novo; esta camada só traduz o erro.
 */

function mensagemErro(erro: unknown): string {
  if (erro instanceof ErroRepositorio) {
    if (erro.codigo === "sem_permissao") {
      return "Só a diretoria altera esta regra. Se você é diretoria, confirme o código do aplicativo (MFA).";
    }
    if (erro.codigo === "recusado") return erro.message;
    if (erro.codigo === "funcao_pendente") {
      return "O banco ainda não tem essa função (ela está sendo escrita por outra trilha agora). Avise a equipe técnica; nada foi alterado.";
    }
  }
  return "Não foi possível salvar agora. Tente de novo em instantes.";
}

const esquemaItem = z.object({
  id: z.string().optional(),
  tipo: z.enum([
    "institucional",
    "faq",
    "objecao",
    "politica",
    "depoimento",
    "equipe",
    "cobertura",
    "plano",
  ]),
  titulo: z.string().trim().min(1, "Escreva um título."),
  texto: z
    .string()
    .trim()
    .min(1, "Escreva o texto.")
    .max(1500, "No máximo 1.500 caracteres."),
  fonte: z.string().trim().optional(),
});

/** Cadastro de um item da base de conhecimento (P27 item 4, PRD 6.8). */
export async function acaoSalvarItemBaseConhecimento(
  _anterior: EstadoAcaoAdmin,
  formulario: FormData,
): Promise<EstadoAcaoAdmin> {
  await exigirSessao("/agente");
  const dados = esquemaItem.safeParse({
    id: formulario.get("id") || undefined,
    tipo: formulario.get("tipo"),
    titulo: formulario.get("titulo"),
    texto: formulario.get("texto"),
    fonte: formulario.get("fonte") || undefined,
  });
  if (!dados.success) {
    return {
      erro:
        dados.error.issues[0]?.message ?? "Confira os dados e tente de novo.",
    };
  }

  try {
    await salvarItemBaseConhecimento(dados.data);
  } catch (erro) {
    return { erro: mensagemErro(erro) };
  }

  revalidatePath("/agente");
  return { sucesso: "Item salvo em rascunho, para aprovação." };
}

/** Aprovação pela diretoria (PRD 13). */
export async function acaoAprovarItemBaseConhecimento(
  _anterior: EstadoAcaoAdmin,
  formulario: FormData,
): Promise<EstadoAcaoAdmin> {
  await exigirSessao("/agente");
  const id = z.string().min(1).safeParse(formulario.get("id"));
  if (!id.success) return { erro: "Não deu para saber qual item é esse." };

  try {
    await aprovarItemBaseConhecimento(id.data);
  } catch (erro) {
    return { erro: mensagemErro(erro) };
  }

  revalidatePath("/agente");
  return { sucesso: "Item aprovado. Entra na próxima reindexação." };
}
