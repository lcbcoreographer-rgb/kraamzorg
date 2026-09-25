"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigirSessao } from "@/lib/auth/sessao";
import { obterRepositorioModulo } from "../dados";
import { extrairVariaveis } from "../dados/mensagem-preview";
import { traduzirErroPadrao, type EstadoFormulario } from "./comum";

export type { EstadoFormulario } from "./comum";

const CANAIS = [
  "whatsapp",
  "site",
  "email",
  "telefone",
  "presencial",
  "outro",
] as const;
const DESTINATARIOS = ["familia", "equipe", "medico", "agente"] as const;

const esquemaRascunho = z.object({
  chave: z.string().min(1),
  canal: z.enum(CANAIS),
  destinatario: z.enum(DESTINATARIOS),
  texto: z.string().min(1, "O texto não pode ficar em branco."),
});

/**
 * Salva o texto como rascunho (PRD 13, "Fazer" item 5: "fluxo de rascunho
 * para aprovado"). Recusa travessão e meia-risca aqui (troca automática
 * por vírgula, como o prompt pede), porque nenhum texto de interface leva
 * travessão (CLAUDE.md).
 */
export async function salvarRascunhoMensagemAction(
  _anterior: EstadoFormulario,
  formulario: FormData,
): Promise<EstadoFormulario> {
  await exigirSessao("/configuracoes");
  const entrada = esquemaRascunho.safeParse({
    chave: formulario.get("chave"),
    canal: formulario.get("canal"),
    destinatario: formulario.get("destinatario"),
    texto: formulario.get("texto"),
  });
  if (!entrada.success) {
    return {
      erro:
        entrada.error.issues[0]?.message ??
        "Confira os campos e tente de novo.",
    };
  }

  const textoSemTravessao = entrada.data.texto
    .replace(/\s+[—–]\s+/g, ", ")
    .replace(/[—–]/g, ",");

  try {
    const repositorio = await obterRepositorioModulo();
    await repositorio.salvarRascunhoMensagem(entrada.data.chave, {
      texto: textoSemTravessao,
      canal: entrada.data.canal,
      destinatario: entrada.data.destinatario,
      variaveis: extrairVariaveis(textoSemTravessao),
    });
  } catch (erro) {
    return { erro: traduzirErroPadrao(erro) };
  }

  revalidatePath("/configuracoes");
  return {
    sucesso:
      textoSemTravessao === entrada.data.texto
        ? "Rascunho salvo."
        : "Rascunho salvo. Trocamos o travessão por vírgula: nenhum texto de interface usa travessão.",
  };
}

const esquemaChave = z.object({ chave: z.string().min(1) });

/** Rascunho para aprovado, com o aprovador registrado (PRD 13, aceite do P13). */
export async function aprovarMensagemAction(
  _anterior: EstadoFormulario,
  formulario: FormData,
): Promise<EstadoFormulario> {
  const sessao = await exigirSessao("/configuracoes");
  const entrada = esquemaChave.safeParse({ chave: formulario.get("chave") });
  if (!entrada.success) return { erro: "Não deu para ler o formulário." };

  try {
    const repositorio = await obterRepositorioModulo();
    await repositorio.aprovarMensagem(entrada.data.chave);
  } catch (erro) {
    return { erro: traduzirErroPadrao(erro) };
  }

  revalidatePath("/configuracoes");
  return { sucesso: `Aprovado por ${sessao.nome}.` };
}

export async function arquivarMensagemAction(
  _anterior: EstadoFormulario,
  formulario: FormData,
): Promise<EstadoFormulario> {
  await exigirSessao("/configuracoes");
  const entrada = esquemaChave.safeParse({ chave: formulario.get("chave") });
  if (!entrada.success) return { erro: "Não deu para ler o formulário." };

  try {
    const repositorio = await obterRepositorioModulo();
    await repositorio.arquivarMensagem(entrada.data.chave);
  } catch (erro) {
    return { erro: traduzirErroPadrao(erro) };
  }

  revalidatePath("/configuracoes");
  return { sucesso: "Mensagem arquivada." };
}
