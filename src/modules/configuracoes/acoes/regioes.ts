"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigirSessao } from "@/lib/auth/sessao";
import { obterRepositorioModulo } from "../dados";
import { paraCentavosBRL } from "../dados/dinheiro";
import { textoParaLista } from "../dados/parametro-tipo";
import { traduzirErroPadrao, type EstadoFormulario } from "./comum";

export type { EstadoFormulario } from "./comum";

const esquemaCentavos = z
  .string()
  .transform((texto) => (texto.trim() === "" ? 0 : paraCentavosBRL(texto)))
  .refine((valor): valor is number => valor !== null && valor >= 0, {
    message: "Digite um valor válido. Ex.: 60,00 ou 60.",
  });

const esquemaRegiao = z.object({
  id: z.string().optional(),
  nome: z.string().min(1, "Digite o nome da região."),
  praca: z.string().min(1, "Digite a praça."),
  limiteFamiliasSemana: z.coerce.number().int().min(0),
  taxaDeslocamentoCentavos: esquemaCentavos,
  ativa: z.enum(["true", "false"]),
});

export async function salvarRegiaoAction(
  _anterior: EstadoFormulario,
  formulario: FormData,
): Promise<EstadoFormulario> {
  await exigirSessao("/configuracoes");
  const entrada = esquemaRegiao.safeParse({
    id: formulario.get("id") || undefined,
    nome: formulario.get("nome"),
    praca: formulario.get("praca"),
    limiteFamiliasSemana: formulario.get("limiteFamiliasSemana"),
    taxaDeslocamentoCentavos: formulario.get("taxaDeslocamentoCentavos") ?? "0",
    ativa: formulario.get("ativa") ?? "true",
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
    praca: entrada.data.praca,
    limiteFamiliasSemana: entrada.data.limiteFamiliasSemana,
    taxaDeslocamentoCentavos: entrada.data.taxaDeslocamentoCentavos,
    ativa: entrada.data.ativa === "true",
  };

  try {
    const repositorio = await obterRepositorioModulo();
    if (entrada.data.id) {
      await repositorio.atualizarRegiao(entrada.data.id, dados);
    } else {
      await repositorio.criarRegiao(dados);
    }
  } catch (erro) {
    return { erro: traduzirErroPadrao(erro) };
  }

  revalidatePath("/configuracoes");
  return { sucesso: "Região salva." };
}

const esquemaCidade = z.object({
  id: z.string().optional(),
  nome: z.string().min(1, "Digite o nome da cidade."),
  uf: z.string().length(2, "A UF tem duas letras."),
  regiaoId: z.string().min(1, "Escolha a região."),
  atendida: z.enum(["true", "false"]),
  requerConfirmacao: z.enum(["true", "false"]),
  taxaDeslocamentoCentavos: esquemaCentavos,
  aliases: z.string().optional(),
  observacao: z.string().optional(),
});

export async function salvarCidadeAction(
  _anterior: EstadoFormulario,
  formulario: FormData,
): Promise<EstadoFormulario> {
  await exigirSessao("/configuracoes");
  const entrada = esquemaCidade.safeParse({
    id: formulario.get("id") || undefined,
    nome: formulario.get("nome"),
    uf: formulario.get("uf"),
    regiaoId: formulario.get("regiaoId"),
    atendida: formulario.get("atendida") ?? "true",
    requerConfirmacao: formulario.get("requerConfirmacao") ?? "false",
    taxaDeslocamentoCentavos: formulario.get("taxaDeslocamentoCentavos") ?? "0",
    aliases: formulario.get("aliases") || undefined,
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
    uf: entrada.data.uf.toUpperCase(),
    regiaoId: entrada.data.regiaoId,
    atendida: entrada.data.atendida === "true",
    requerConfirmacao: entrada.data.requerConfirmacao === "true",
    taxaDeslocamentoCentavos: entrada.data.taxaDeslocamentoCentavos,
    aliases: textoParaLista(entrada.data.aliases ?? ""),
    observacao: entrada.data.observacao?.trim() || null,
  };

  try {
    const repositorio = await obterRepositorioModulo();
    if (entrada.data.id) {
      await repositorio.atualizarCidade(entrada.data.id, dados);
    } else {
      await repositorio.criarCidade(dados);
    }
  } catch (erro) {
    return { erro: traduzirErroPadrao(erro) };
  }

  revalidatePath("/configuracoes");
  return { sucesso: "Cidade salva." };
}
