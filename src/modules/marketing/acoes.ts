"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigirSessao } from "@/lib/auth/sessao";
import { obterRepositorios } from "@/lib/dados/fabrica";
import { ORIGENS_DE_CANAL } from "@/modules/relacao/rotulos";
import {
  fraseErroRelacao,
  reaisParaCentavos,
  type EstadoAcaoRelacao,
} from "@/modules/relacao/frases";

// Só funções assíncronas saem daqui ("use server"); o estado fica em
// src/modules/relacao/frases.ts.

const esquemaCanal = z.object({
  id: z.union([z.uuid(), z.literal("")]).optional(),
  codigo: z.string().trim().min(1).max(40),
  nome: z.string().trim().min(2).max(80),
  origem: z.enum(ORIGENS_DE_CANAL as [string, ...string[]]),
  ativo: z.enum(["sim", "nao"]).default("sim"),
});

/** Cria ou edita um canal de captação (P47 item 1). */
export async function acaoSalvarCanal(
  _anterior: EstadoAcaoRelacao,
  dados: FormData,
): Promise<EstadoAcaoRelacao> {
  await exigirSessao("/marketing");
  const lido = esquemaCanal.safeParse({
    id: dados.get("id") ?? "",
    codigo: dados.get("codigo"),
    nome: dados.get("nome"),
    origem: dados.get("origem"),
    ativo: dados.get("ativo") ?? "sim",
  });
  if (!lido.success) {
    return {
      erro: "Confira o código, o nome e a origem do canal. Nada foi salvo.",
    };
  }
  try {
    const { relacao } = await obterRepositorios();
    const canal = await relacao.marketing.salvarCanal({
      id: lido.data.id || null,
      codigo: lido.data.codigo,
      nome: lido.data.nome,
      origem: lido.data.origem as never,
      ativo: lido.data.ativo === "sim",
    });
    revalidatePath("/marketing");
    return { sucesso: `Canal ${canal.codigo} salvo.` };
  } catch (erro) {
    return { erro: fraseErroRelacao(erro, "salvar o canal") };
  }
}

const esquemaCusto = z.object({
  canalId: z.uuid(),
  mes: z.string().regex(/^\d{4}-\d{2}$/),
  valor: z.string().min(1),
});

/** Custo do mês de um canal, em reais no campo e em centavos no banco (P47 item 3). */
export async function acaoSalvarCusto(
  _anterior: EstadoAcaoRelacao,
  dados: FormData,
): Promise<EstadoAcaoRelacao> {
  await exigirSessao("/marketing");
  const lido = esquemaCusto.safeParse({
    canalId: dados.get("canalId"),
    mes: dados.get("mes"),
    valor: dados.get("valor"),
  });
  const centavos = lido.success ? reaisParaCentavos(lido.data.valor) : null;
  if (!lido.success || centavos === null) {
    return {
      erro: "Escolha o canal e o mês e digite o valor em reais, como 1.500,00. Nada foi salvo.",
    };
  }
  try {
    const { relacao } = await obterRepositorios();
    await relacao.marketing.salvarCusto({
      canalId: lido.data.canalId,
      mes: `${lido.data.mes}-01`,
      valorCentavos: centavos,
    });
    revalidatePath("/marketing");
    return { sucesso: "Custo do mês salvo." };
  } catch (erro) {
    return { erro: fraseErroRelacao(erro, "salvar o custo") };
  }
}
