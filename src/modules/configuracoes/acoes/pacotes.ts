"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigirSessao } from "@/lib/auth/sessao";
import { obterRepositorioModulo } from "../dados";
import { paraCentavosBRL } from "../dados/dinheiro";
import { textoParaLista } from "../dados/parametro-tipo";
import { traduzirErroPadrao, type EstadoFormulario } from "./comum";

export type { EstadoFormulario } from "./comum";

const esquemaMoeda = z
  .string()
  .min(1, "Digite o preço.")
  .transform((texto) => paraCentavosBRL(texto))
  .refine((centavos): centavos is number => centavos !== null && centavos > 0, {
    message: "Digite um preço maior que zero. Ex.: 4200,00 ou 4.200,00.",
  });

const esquemaNovaVersao = z.object({
  pacoteId: z.string().min(1),
  valorCentavos: esquemaMoeda,
  horasPorVisita: z.coerce.number().positive(),
  parcelasMaxSemJuros: z.coerce.number().int().min(1).max(12),
  destaque: z.string().optional(),
  vigenciaInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida."),
  inclui: z.string().optional(),
  naoInclui: z.string().optional(),
});

/**
 * Cria uma versão nova de preço para um pacote existente (PRD 6.3, D-06;
 * aceite do P13: "a diretoria cria nova versão de preço e o contrato
 * antigo continua na versão anterior"). Nunca edita a versão vigente: ela
 * é fechada e a nova nasce ao lado.
 */
export async function criarVersaoPacoteAction(
  _anterior: EstadoFormulario,
  formulario: FormData,
): Promise<EstadoFormulario> {
  await exigirSessao("/configuracoes");
  const entrada = esquemaNovaVersao.safeParse({
    pacoteId: formulario.get("pacoteId"),
    valorCentavos: formulario.get("valor"),
    horasPorVisita: formulario.get("horasPorVisita"),
    parcelasMaxSemJuros: formulario.get("parcelasMaxSemJuros"),
    destaque: formulario.get("destaque") || undefined,
    vigenciaInicio: formulario.get("vigenciaInicio"),
    inclui: formulario.get("inclui") || undefined,
    naoInclui: formulario.get("naoInclui") || undefined,
  });
  if (!entrada.success) {
    return {
      erro:
        entrada.error.issues[0]?.message ??
        "Não deu para ler o formulário. Confira os campos.",
    };
  }

  try {
    const repositorio = await obterRepositorioModulo();
    await repositorio.criarVersaoPacote({
      pacoteId: entrada.data.pacoteId,
      valorCentavos: entrada.data.valorCentavos,
      horasPorVisita: entrada.data.horasPorVisita,
      parcelasMaxSemJuros: entrada.data.parcelasMaxSemJuros,
      destaque: entrada.data.destaque?.trim() || null,
      vigenciaInicio: entrada.data.vigenciaInicio,
      inclui: textoParaLista(entrada.data.inclui ?? ""),
      naoInclui: textoParaLista(entrada.data.naoInclui ?? ""),
    });
  } catch (erro) {
    return { erro: traduzirErroPadrao(erro) };
  }

  revalidatePath("/configuracoes");
  return {
    sucesso: "Nova versão de preço criada. A anterior não foi alterada.",
  };
}

const esquemaAtivar = z.object({
  pacoteId: z.string().min(1),
  ativo: z.enum(["true", "false"]),
});

export async function ativarPacoteAction(
  _anterior: EstadoFormulario,
  formulario: FormData,
): Promise<EstadoFormulario> {
  await exigirSessao("/configuracoes");
  const entrada = esquemaAtivar.safeParse({
    pacoteId: formulario.get("pacoteId"),
    ativo: formulario.get("ativo"),
  });
  if (!entrada.success) return { erro: "Não deu para ler o formulário." };

  try {
    const repositorio = await obterRepositorioModulo();
    await repositorio.ativarPacote(
      entrada.data.pacoteId,
      entrada.data.ativo === "true",
    );
  } catch (erro) {
    return { erro: traduzirErroPadrao(erro) };
  }

  revalidatePath("/configuracoes");
  return {
    sucesso:
      entrada.data.ativo === "true"
        ? "Pacote reativado."
        : "Pacote desativado.",
  };
}
