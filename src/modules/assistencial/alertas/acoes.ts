"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigirSessao } from "@/lib/auth/sessao";
import { fraseDoErro } from "@/lib/checklist/erros";
import { obterRepositorios } from "@/lib/dados/fabrica";

/**
 * Ações de servidor da lista de alertas clínicos (P40). O registro dos
 * quatro campos do DOC 3 e o fechamento passam pelas funções `api` do
 * banco, que conferem papel, MFA e a atribuição da família; a sessão daqui
 * é só a primeira barreira. Recusa de negócio volta como frase pronta.
 */

export type ResultadoAcaoAlerta =
  { ok: true } | { ok: false; mensagem: string };

const pedidoAcionamento = z.object({
  alertaId: z.uuid(),
  versaoBase: z.number().int().nullable(),
  sinalIdentificado: z.string().max(2000).optional(),
  acionadoEm: z.iso.datetime({ offset: true }).optional(),
  orientacaoMedica: z.string().max(4000).optional(),
  condutaAdotada: z.string().max(4000).optional(),
});

export type PedidoAcionamentoDaTela = z.input<typeof pedidoAcionamento>;

export async function acaoRegistrarAcionamento(
  pedido: PedidoAcionamentoDaTela,
): Promise<ResultadoAcaoAlerta> {
  const sessao = await exigirSessao();
  if (!sessao.papeis.some((p) => p === "enfermeira" || p === "coordenacao")) {
    return {
      ok: false,
      mensagem: "Só a enfermeira e a coordenação registram o acionamento.",
    };
  }
  const lido = pedidoAcionamento.safeParse(pedido);
  if (!lido.success) {
    return {
      ok: false,
      mensagem:
        "Confira os campos do registro. Algum deles não está no formato esperado.",
    };
  }
  try {
    const { assistencial } = await obterRepositorios();
    await assistencial.registrarAcionamento(lido.data);
  } catch (erro) {
    return {
      ok: false,
      mensagem: fraseDoErro(erro, "registrar o acionamento"),
    };
  }
  revalidatePath("/alertas");
  revalidatePath("/alertas-clinicos");
  return { ok: true };
}

export async function acaoFecharAlerta(
  alertaId: string,
  versaoBase: number | null,
): Promise<ResultadoAcaoAlerta> {
  const sessao = await exigirSessao();
  if (!sessao.papeis.includes("coordenacao")) {
    return { ok: false, mensagem: "Só a coordenação fecha o alerta." };
  }
  if (!z.uuid().safeParse(alertaId).success) {
    return { ok: false, mensagem: "Alerta não encontrado. Atualize a tela." };
  }
  try {
    const { assistencial } = await obterRepositorios();
    await assistencial.fecharAlerta(alertaId, versaoBase);
  } catch (erro) {
    return { ok: false, mensagem: fraseDoErro(erro, "fechar o alerta") };
  }
  revalidatePath("/alertas");
  revalidatePath("/alertas-clinicos");
  return { ok: true };
}
