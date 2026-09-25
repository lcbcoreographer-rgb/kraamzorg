"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigirSessao } from "@/lib/auth/sessao";
import { obterRepositorioModulo } from "../dados";
import { traduzirErroPadrao, type EstadoFormulario } from "./comum";

export type { EstadoFormulario } from "./comum";

const TIPOS = ["desconto_pct", "parcelamento", "bonificacao"] as const;

const esquema = z.object({
  id: z.string().optional(),
  nome: z.string().min(1, "Digite o nome da condição."),
  tipo: z.enum(TIPOS),
  valor: z.coerce.number().positive("Digite um valor maior que zero."),
  requerAprovacao: z.enum(["true", "false"]),
  ativa: z.enum(["true", "false"]),
  observacao: z.string().optional(),
});

/** Cria ou atualiza uma condição comercial (PRD 6.3, "tabela única de condições"). */
export async function salvarCondicaoComercialAction(
  _anterior: EstadoFormulario,
  formulario: FormData,
): Promise<EstadoFormulario> {
  await exigirSessao("/configuracoes");
  const entrada = esquema.safeParse({
    id: formulario.get("id") || undefined,
    nome: formulario.get("nome"),
    tipo: formulario.get("tipo"),
    valor: formulario.get("valor"),
    requerAprovacao: formulario.get("requerAprovacao") ?? "true",
    ativa: formulario.get("ativa") ?? "true",
    observacao: formulario.get("observacao") || undefined,
  });
  if (!entrada.success) {
    return {
      erro:
        entrada.error.issues[0]?.message ??
        "Confira os campos e tente de novo.",
    };
  }

  const dados = {
    nome: entrada.data.nome,
    tipo: entrada.data.tipo,
    valor: entrada.data.valor,
    requerAprovacao: entrada.data.requerAprovacao === "true",
    ativa: entrada.data.ativa === "true",
    observacao: entrada.data.observacao?.trim() || null,
  };

  try {
    const repositorio = await obterRepositorioModulo();
    if (entrada.data.id) {
      await repositorio.atualizarCondicaoComercial(entrada.data.id, dados);
    } else {
      await repositorio.criarCondicaoComercial(dados);
    }
  } catch (erro) {
    return { erro: traduzirErroPadrao(erro) };
  }

  revalidatePath("/configuracoes");
  return { sucesso: "Condição comercial salva." };
}
