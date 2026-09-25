"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigirSessao } from "@/lib/auth/sessao";
import { ErroRepositorio } from "@/lib/dados/erros";
import { obterRepositorios } from "@/lib/dados/fabrica";
import { formatarDataHora } from "@/lib/formatacao";

export interface EstadoRevogacao {
  erro?: string;
  sucesso?: string;
}

/**
 * Encerra todas as sessões abertas de uma pessoa (PRD 13 e 21.2: "a
 * diretoria pode revogar sessões de um usuário"). Confere o papel aqui e o
 * banco confere de novo na função api.revogar_sessoes.
 */
export async function revogarSessoes(
  _anterior: EstadoRevogacao,
  formulario: FormData,
): Promise<EstadoRevogacao> {
  const sessao = await exigirSessao("/sessoes");
  if (!sessao.papeis.includes("diretoria")) {
    return { erro: "Só a diretoria encerra sessões de outras pessoas." };
  }
  const usuarioId = z.string().min(1).safeParse(formulario.get("usuarioId"));
  if (!usuarioId.success)
    return {
      erro: "Não deu para saber de quem são as sessões. Tente de novo.",
    };

  try {
    const { usuarios } = await obterRepositorios();
    await usuarios.revogarSessoes(usuarioId.data);
  } catch (erro) {
    if (erro instanceof ErroRepositorio && erro.codigo === "funcao_pendente") {
      return {
        erro: "O banco ainda não tem a função que encerra sessões. Avise a equipe técnica; nada foi alterado.",
      };
    }
    if (erro instanceof ErroRepositorio && erro.codigo === "sem_permissao") {
      return {
        erro: "O banco recusou: confirme o código do aplicativo e tente de novo.",
      };
    }
    return {
      erro: "Não foi possível encerrar as sessões agora. Tente de novo em instantes.",
    };
  }

  revalidatePath("/sessoes");
  const hora = formatarDataHora(new Date())?.split(" ").at(-1) ?? "";
  return {
    sucesso: `Sessões encerradas${hora ? ` às ${hora}` : ""}. A pessoa precisa entrar de novo em todos os aparelhos.`,
  };
}
