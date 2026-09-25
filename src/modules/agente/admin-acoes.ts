"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { EstadoAcaoAdmin } from "./estado-acoes";
import { exigirSessao } from "@/lib/auth/sessao";
import { ErroRepositorio } from "@/lib/dados/erros";
import {
  aprovarItemBaseConhecimento,
  salvarConfiguracaoAgente,
  salvarItemBaseConhecimento,
  salvarRegraRetomada,
} from "./repositorio";

/**
 * Ações da tela `/agente` (P27 itens 3 e 4): modo do agente e números de
 * teste, janela de retomada e base de conhecimento. Tudo aqui exige
 * diretoria (`repositorio.ts` confere de novo, o banco confere pela
 * terceira vez pela RLS quando a função `api.*` chegar); esta camada só
 * traduz o erro.
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

const E164 = /^\+[1-9]\d{7,14}$/;

const esquemaModo = z.object({
  modo: z.enum(["desligado", "teste", "producao"]),
  numerosTeste: z.string(),
});

/** "Modo do agente" e a lista de números de teste (PRD 11.3, 11.7). */
export async function acaoSalvarModoAgente(
  _anterior: EstadoAcaoAdmin,
  formulario: FormData,
): Promise<EstadoAcaoAdmin> {
  await exigirSessao("/agente");
  const dados = esquemaModo.safeParse({
    modo: formulario.get("modo"),
    numerosTeste: formulario.get("numerosTeste") ?? "",
  });
  if (!dados.success) return { erro: "Escolha um modo válido." };

  const numeros = [
    ...new Set(
      dados.data.numerosTeste
        .split(/[\n,;]/)
        .map((n) => n.replace(/[\s().-]/g, ""))
        .filter(Boolean),
    ),
  ];
  // PRD 6.8 e CLAUDE.md: telefone em E.164. Um número torto na lista de
  // teste faz a Isadora calar para quem devia responder, sem aviso.
  const invalidos = numeros.filter((n) => !E164.test(n));
  if (invalidos.length > 0) {
    return {
      erro: `Confira ${invalidos.length === 1 ? "este número" : "estes números"}: ${invalidos.join(", ")}. Use o formato com +55 e DDD, por exemplo +5511900000001.`,
    };
  }
  if (dados.data.modo === "teste" && numeros.length === 0) {
    return {
      erro: "Em teste, a Isadora só responde aos números da lista. Inclua pelo menos um.",
    };
  }

  try {
    await salvarConfiguracaoAgente({
      modo: dados.data.modo,
      numerosTeste: numeros,
    });
  } catch (erro) {
    return { erro: mensagemErro(erro) };
  }

  revalidatePath("/agente");
  return { sucesso: "Modo da Isadora salvo." };
}

// Mínimo de 24 h: PRD 11.3 e `parametro.agente_followup_horas` (a função de
// gravação do banco também recusa valor menor).
const esquemaRegra = z.object({ horas: z.coerce.number().int().min(24) });

/** Janela de retomada de quem parou de responder (telas.md C6). */
export async function acaoSalvarRegraRetomada(
  _anterior: EstadoAcaoAdmin,
  formulario: FormData,
): Promise<EstadoAcaoAdmin> {
  await exigirSessao("/agente");
  const dados = esquemaRegra.safeParse({ horas: formulario.get("horas") });
  if (!dados.success) {
    return { erro: "A janela mínima de retomada é 24 horas." };
  }

  try {
    await salvarRegraRetomada(dados.data.horas);
  } catch (erro) {
    return { erro: mensagemErro(erro) };
  }

  revalidatePath("/agente");
  return { sucesso: "Regra de retomada salva." };
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
