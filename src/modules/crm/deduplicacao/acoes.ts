"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { exigirSessao } from "@/lib/auth/sessao";
import { ErroRepositorio } from "@/lib/dados/erros";
import { mesclarFamilias, vincularNovaGestacao } from "./mesclagem";

export interface EstadoAcaoMesclagem {
  erro?: string;
}

export const estadoInicialMesclagem: EstadoAcaoMesclagem = {};

function mensagemErro(erro: unknown): string {
  if (erro instanceof ErroRepositorio) {
    if (erro.codigo === "funcao_pendente") {
      return "O banco ainda não tem a função de mesclagem. Avise a equipe técnica; nada foi alterado.";
    }
    if (erro.codigo === "sem_permissao") {
      return "O banco recusou: confirme o papel e tente de novo.";
    }
    if (erro.codigo === "recusado") {
      return "Não deu para fechar a oportunidade que não ficou (o estágio atual dela não vai direto para perdido). Avise a coordenação antes de mesclar.";
    }
    if (erro.codigo === "nao_encontrado") {
      return "Uma das duas famílias não existe mais. Atualize a lista de duplicatas.";
    }
  }
  return "Não foi possível mesclar agora. Tente de novo em instantes.";
}

/** Mescla as duas famílias (P17 item 2). Sem desfazer: por isso a
 * confirmação já aconteceu na tela antes de chamar esta ação. */
export async function acaoMesclar(
  _anterior: EstadoAcaoMesclagem,
  formulario: FormData,
): Promise<EstadoAcaoMesclagem> {
  await exigirSessao("/pipeline/duplicatas");
  const dados = z
    .object({
      familiaFicaId: z.uuid(),
      familiaPerdeId: z.uuid(),
      oportunidadeFicaId: z.uuid().optional(),
    })
    .safeParse({
      familiaFicaId: formulario.get("familiaFicaId"),
      familiaPerdeId: formulario.get("familiaPerdeId"),
      oportunidadeFicaId: formulario.get("oportunidadeFicaId") || undefined,
    });
  if (!dados.success) {
    return {
      erro: "Não deu para saber quais famílias mesclar. Volte e tente de novo.",
    };
  }

  try {
    await mesclarFamilias(dados.data);
  } catch (erro) {
    return { erro: mensagemErro(erro) };
  }

  revalidatePath("/pipeline/duplicatas");
  revalidatePath("/pipeline");
  redirect("/pipeline/duplicatas?mesclada=1");
}

/** Vínculo de nova gestação (P17 item 1): não mescla, só liga por
 * `familia_anterior_id`. */
export async function acaoVincularNovaGestacao(
  _anterior: EstadoAcaoMesclagem,
  formulario: FormData,
): Promise<EstadoAcaoMesclagem> {
  await exigirSessao("/pipeline/duplicatas");
  const dados = z
    .object({
      familiaRecenteId: z.uuid(),
      familiaAnteriorId: z.uuid(),
    })
    .safeParse({
      familiaRecenteId: formulario.get("familiaRecenteId"),
      familiaAnteriorId: formulario.get("familiaAnteriorId"),
    });
  if (!dados.success) {
    return {
      erro: "Não deu para saber quais famílias vincular. Volte e tente de novo.",
    };
  }

  try {
    await vincularNovaGestacao(
      dados.data.familiaRecenteId,
      dados.data.familiaAnteriorId,
    );
  } catch (erro) {
    return { erro: mensagemErro(erro) };
  }

  revalidatePath("/pipeline/duplicatas");
  redirect("/pipeline/duplicatas?vinculada=1");
}
