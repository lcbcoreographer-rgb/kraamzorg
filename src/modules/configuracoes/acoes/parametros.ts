"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigirSessao } from "@/lib/auth/sessao";
import { obterRepositorioModulo } from "../dados";
import { validarNovoValorParametro } from "../dados/parametro-tipo";
import type { TipoParametro } from "../dados/tipos";
import { traduzirErroPadrao, type EstadoFormulario } from "./comum";

export type { EstadoFormulario } from "./comum";

const TIPOS: readonly TipoParametro[] = [
  "inteiro",
  "decimal",
  "booleano",
  "texto",
  "lista_texto",
  "objeto",
  "nulo",
];

const esquemaAtualizar = z.object({
  chave: z.string().min(1),
  tipo: z.enum(TIPOS as [TipoParametro, ...TipoParametro[]]),
  valor: z.string(),
});

/**
 * Grava o novo valor de um parâmetro (P13, "Fazer" item 1). A validação por
 * tipo roda aqui (mesma forma do valor atual, `parametro-tipo.ts`); o banco
 * confere o papel de novo pela RLS.
 */
export async function atualizarParametroAction(
  _anterior: EstadoFormulario,
  formulario: FormData,
): Promise<EstadoFormulario> {
  await exigirSessao("/configuracoes");
  const entrada = esquemaAtualizar.safeParse({
    chave: formulario.get("chave"),
    tipo: formulario.get("tipo"),
    valor: formulario.get("valor"),
  });
  if (!entrada.success) {
    return { erro: "Não deu para ler o formulário. Tente de novo." };
  }

  const validado = validarNovoValorParametro(
    entrada.data.tipo,
    entrada.data.valor,
  );
  if (!validado.ok) {
    return { erro: validado.erro };
  }

  try {
    const repositorio = await obterRepositorioModulo();
    await repositorio.atualizarParametro(entrada.data.chave, validado.valor);
  } catch (erro) {
    return { erro: traduzirErroPadrao(erro) };
  }

  revalidatePath("/configuracoes");
  return { sucesso: `Parâmetro ${entrada.data.chave} atualizado.` };
}
