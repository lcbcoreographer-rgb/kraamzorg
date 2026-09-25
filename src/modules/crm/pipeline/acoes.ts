"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigirSessao } from "@/lib/auth/sessao";
import { ErroRepositorio } from "@/lib/dados/erros";
import type { MotivoPerda, NumeroPipeline } from "@/lib/dados/tipos";
import { criarLeadManual, marcarPerdido, transicionarEstagio } from "./dados";
import { MOTIVOS_PERDA, ORIGENS_LEAD, PAPEIS_PESSOA } from "./estagios";

export interface EstadoAcaoPipeline {
  erro?: string;
  sucesso?: string;
}

export const estadoInicialPipeline: EstadoAcaoPipeline = {};

function mensagemErro(erro: unknown, contexto: string): string {
  if (erro instanceof ErroRepositorio) {
    if (erro.codigo === "sem_permissao") {
      return "O banco recusou: confirme o papel e o código do aplicativo e tente de novo.";
    }
    if (erro.codigo === "recusado") {
      return `Esse passo não existe a partir do estágio atual. Atualize a tela e tente de novo.`;
    }
    if (erro.codigo === "nao_encontrado") {
      return "Essa família não está mais no pipeline. Atualize a tela.";
    }
    if (erro.codigo === "funcao_pendente") {
      return "O banco ainda não tem essa função. Avise a equipe técnica; nada foi alterado.";
    }
  }
  return `Não foi possível ${contexto} agora. Tente de novo em instantes.`;
}

const pipelineSchema = z.union([z.literal("1"), z.literal("2")]);

/** Muda o estágio de uma oportunidade (P15 item 2). Só oferece, do lado da
 * tela, as transições de `destinosPermitidos`; quem barra de verdade é o
 * banco (PRD 7, invariante 1). */
export async function acaoTransicionar(
  _anterior: EstadoAcaoPipeline,
  formulario: FormData,
): Promise<EstadoAcaoPipeline> {
  await exigirSessao("/pipeline");
  const dados = z
    .object({
      oportunidadeId: z.uuid(),
      pipeline: pipelineSchema,
      para: z.string().min(1),
    })
    .safeParse({
      oportunidadeId: formulario.get("oportunidadeId"),
      pipeline: formulario.get("pipeline"),
      para: formulario.get("para"),
    });
  if (!dados.success) {
    return {
      erro: "Não deu para saber qual oportunidade mover. Tente de novo.",
    };
  }

  try {
    await transicionarEstagio({
      oportunidadeId: dados.data.oportunidadeId,
      pipeline: Number(dados.data.pipeline) as NumeroPipeline,
      para: dados.data.para,
    });
  } catch (erro) {
    return { erro: mensagemErro(erro, "mover a oportunidade") };
  }

  revalidatePath("/pipeline");
  return { sucesso: "Estágio atualizado." };
}

/** Marca a oportunidade como perdida, com motivo e detalhe (P15 item 2). */
export async function acaoMarcarPerdido(
  _anterior: EstadoAcaoPipeline,
  formulario: FormData,
): Promise<EstadoAcaoPipeline> {
  await exigirSessao("/pipeline");
  const dados = z
    .object({
      oportunidadeId: z.uuid(),
      pipeline: pipelineSchema,
      motivo: z.enum(MOTIVOS_PERDA),
      detalhe: z.string().max(500).optional(),
    })
    .safeParse({
      oportunidadeId: formulario.get("oportunidadeId"),
      pipeline: formulario.get("pipeline"),
      motivo: formulario.get("motivo"),
      detalhe: formulario.get("detalhe") || undefined,
    });
  if (!dados.success) {
    return { erro: "Escolha um motivo. Ele alimenta o relatório de perdas." };
  }

  try {
    await marcarPerdido({
      oportunidadeId: dados.data.oportunidadeId,
      pipeline: Number(dados.data.pipeline) as NumeroPipeline,
      motivo: dados.data.motivo as MotivoPerda,
      detalhe: dados.data.detalhe,
    });
  } catch (erro) {
    return { erro: mensagemErro(erro, "marcar como perdida") };
  }

  revalidatePath("/pipeline");
  return { sucesso: "A família saiu do pipeline e para de receber follow-up." };
}

/** Cadastro manual de lead pelo comercial (P15 item 4). */
export async function acaoCriarLead(
  _anterior: EstadoAcaoPipeline,
  formulario: FormData,
): Promise<EstadoAcaoPipeline> {
  await exigirSessao("/pipeline");
  const dados = z
    .object({
      nomeFamilia: z.string().trim().min(2, "Escreva o nome da família."),
      bairro: z.string().trim().optional(),
      cidadeInformada: z.string().trim().optional(),
      dpp: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional()
        .or(z.literal("")),
      origem: z.enum(ORIGENS_LEAD),
      nomeContato: z.string().trim().min(2, "Escreva o nome do contato."),
      papelContato: z.enum(PAPEIS_PESSOA),
      telefoneE164: z.string().trim().min(8, "Escreva o telefone de contato."),
    })
    .safeParse({
      nomeFamilia: formulario.get("nomeFamilia"),
      bairro: formulario.get("bairro") || undefined,
      cidadeInformada: formulario.get("cidadeInformada") || undefined,
      dpp: formulario.get("dpp") || undefined,
      origem: formulario.get("origem"),
      nomeContato: formulario.get("nomeContato"),
      papelContato: formulario.get("papelContato"),
      telefoneE164: formulario.get("telefoneE164"),
    });
  if (!dados.success) {
    const primeiro = dados.error.issues[0]?.message;
    return {
      erro: primeiro || "Confira os campos obrigatórios e tente de novo.",
    };
  }

  try {
    await criarLeadManual({
      nomeFamilia: dados.data.nomeFamilia,
      bairro: dados.data.bairro,
      cidadeInformada: dados.data.cidadeInformada,
      dpp: dados.data.dpp || undefined,
      origem: dados.data.origem,
      nomeContato: dados.data.nomeContato,
      papelContato: dados.data.papelContato,
      telefoneE164: dados.data.telefoneE164,
    });
  } catch (erro) {
    if (erro instanceof ErroRepositorio && erro.codigo === "recusado") {
      return {
        erro: "Esse telefone não parece um número válido. Confira o DDD e tente de novo.",
      };
    }
    return { erro: mensagemErro(erro, "cadastrar a família") };
  }

  revalidatePath("/pipeline");
  return { sucesso: "Família cadastrada em Novo, no pipeline de entrada." };
}
