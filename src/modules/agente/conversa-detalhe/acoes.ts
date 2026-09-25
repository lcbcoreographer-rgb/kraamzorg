"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigirSessao } from "@/lib/auth/sessao";
import { ErroRepositorio } from "@/lib/dados/erros";
import { criarMensageiro } from "@/lib/messaging";
import { criarVerificadorFreio } from "@/modules/mensageria/tarefas/verificador-freio";
import { registrarEnvioConversa } from "./registrar-envio";

export interface EstadoEnvioConversa {
  erro?: string;
  sucesso?: string;
}

export const estadoInicialEnvioConversa: EstadoEnvioConversa = {};

/**
 * "Enviar" pelo app (C2, decisão pendente do cliente em `fluxos.md`,
 * item 3: `comercial_resposta_no_app`). Sai pelo canal `manual`
 * (`src/lib/messaging`, PRD 4.1 D-08): confere o freio, monta o link e
 * grava a mensagem como se a pessoa tivesse tocado em enviar no WhatsApp.
 * Sem família (conversa ainda não ligada a uma), não há freio para
 * checar: a única barreira é a sessão.
 */
export async function acaoEnviarMensagemConversa(
  _anterior: EstadoEnvioConversa,
  formulario: FormData,
): Promise<EstadoEnvioConversa> {
  const sessao = await exigirSessao("/conversas");

  const dados = z
    .object({
      conversaId: z.string().min(1),
      familiaId: z.string().min(1).nullable(),
      telefoneE164: z.string().min(1, "Esta conversa não tem telefone cadastrado."),
      texto: z.string().trim().min(1, "Escreva alguma coisa antes de enviar."),
    })
    .safeParse({
      conversaId: formulario.get("conversaId"),
      familiaId: formulario.get("familiaId") || null,
      telefoneE164: formulario.get("telefoneE164"),
      texto: formulario.get("texto"),
    });
  if (!dados.success) {
    return { erro: dados.error.issues[0]?.message ?? "Confira os dados e tente de novo." };
  }

  try {
    if (dados.data.familiaId) {
      const mensageiro = criarMensageiro("manual");
      const resultado = await mensageiro.enviar(
        {
          familiaId: dados.data.familiaId,
          categoria: "conteudo",
          destinatario: "familia",
          telefoneOuJid: dados.data.telefoneE164,
          texto: dados.data.texto,
        },
        criarVerificadorFreio(),
      );
      if (!resultado.ok) return { erro: resultado.motivo };
    }
    await registrarEnvioConversa(dados.data.conversaId, dados.data.texto);
  } catch (erro) {
    if (erro instanceof ErroRepositorio) {
      return {
        erro:
          erro.codigo === "indisponivel"
            ? "Não saiu. A família não recebeu. Tente de novo ou abra no WhatsApp."
            : "Não foi possível enviar agora. Tente de novo em instantes.",
      };
    }
    return { erro: "Não foi possível enviar agora. Tente de novo em instantes." };
  }

  revalidatePath(`/conversas/${dados.data.conversaId}`);
  return { sucesso: `Enviado por ${sessao.nome.split(" ")[0]}.` };
}
