"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigirSessao } from "@/lib/auth/sessao";
import { obterRepositorioModulo } from "../dados";
import { traduzirErroPadrao, type EstadoFormulario } from "./comum";

export type { EstadoFormulario } from "./comum";

const esquema = z.object({
  id: z.string().min(1),
  objetivo: z.string().min(1, "Digite o objetivo da faixa."),
  gatilhoComercial: z.string().min(1, "Digite o gatilho comercial."),
  mensagemChave: z.string().min(1, "Escolha a mensagem da faixa."),
});

/** Atualiza uma faixa da régua (PRD 10.3): objetivo, gatilho e a mensagem ligada. */
export async function atualizarFaixaReguaAction(
  _anterior: EstadoFormulario,
  formulario: FormData,
): Promise<EstadoFormulario> {
  await exigirSessao("/configuracoes");
  const entrada = esquema.safeParse({
    id: formulario.get("id"),
    objetivo: formulario.get("objetivo"),
    gatilhoComercial: formulario.get("gatilhoComercial"),
    mensagemChave: formulario.get("mensagemChave"),
  });
  if (!entrada.success) {
    return {
      erro:
        entrada.error.issues[0]?.message ??
        "Confira os campos e tente de novo.",
    };
  }

  try {
    const repositorio = await obterRepositorioModulo();
    await repositorio.atualizarFaixaRegua(entrada.data.id, {
      objetivo: entrada.data.objetivo,
      gatilhoComercial: entrada.data.gatilhoComercial,
      mensagemChave: entrada.data.mensagemChave,
    });
  } catch (erro) {
    return { erro: traduzirErroPadrao(erro) };
  }

  revalidatePath("/configuracoes");
  return { sucesso: "Faixa da régua atualizada." };
}
