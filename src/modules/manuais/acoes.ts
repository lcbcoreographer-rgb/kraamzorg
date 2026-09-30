"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigirSessao } from "@/lib/auth/sessao";
import { obterRepositorios } from "@/lib/dados/fabrica";
import {
  fraseErroRelacao,
  type EstadoAcaoRelacao,
} from "@/modules/relacao/frases";

const PAPEIS = [
  "comercial",
  "enfermeira",
  "financeiro",
  "marketing",
  "coordenacao",
  "diretoria",
] as const;

const esquemaManual = z.object({
  manualId: z.union([z.uuid(), z.literal("")]).default(""),
  titulo: z.string().trim().min(3).max(160),
  categoria: z.enum(["manual", "protocolo"]),
  conteudo: z.string().trim().min(1).max(60000),
  resumoMudanca: z.string().trim().max(300).default(""),
  ativo: z.string().optional(),
});

/** Salva o manual ou o protocolo. Texto que mudou gera versão nova (P51 item 2). */
export async function acaoSalvarManual(
  _anterior: EstadoAcaoRelacao,
  dados: FormData,
): Promise<EstadoAcaoRelacao> {
  await exigirSessao("/manuais");
  const lido = esquemaManual.safeParse(Object.fromEntries(dados.entries()));
  if (!lido.success) {
    return {
      erro: "Confira o título e o texto. O texto não pode ficar vazio. Nada foi salvo.",
    };
  }
  const papeisAlvo = dados
    .getAll("papeisAlvo")
    .map(String)
    .filter((p): p is (typeof PAPEIS)[number] =>
      (PAPEIS as readonly string[]).includes(p),
    );
  try {
    const { relacao } = await obterRepositorios();
    const r = await relacao.manuais.salvar({
      manualId: lido.data.manualId || null,
      titulo: lido.data.titulo,
      categoria: lido.data.categoria,
      papeisAlvo,
      conteudo: lido.data.conteudo,
      resumoMudanca: lido.data.resumoMudanca,
      ativo: lido.data.ativo !== "nao",
    });
    revalidatePath("/manuais");
    revalidatePath(`/manuais/${r.manualId}`);
    revalidatePath("/treinamentos");
    return {
      sucesso: r.novaVersao
        ? `Salvo como versão ${r.versao}. Quem já leu precisa confirmar de novo.`
        : "Salvo. O texto não mudou, então a versão continua a mesma.",
    };
  } catch (erro) {
    return { erro: fraseErroRelacao(erro, "salvar o manual") };
  }
}

/** A pessoa confirma que leu a versão atual (P51 item 2). */
export async function acaoConfirmarLeitura(
  versaoId: string,
): Promise<EstadoAcaoRelacao> {
  await exigirSessao("/manuais");
  const v = z.uuid().safeParse(versaoId);
  if (!v.success) return { erro: "Atualize a tela e tente de novo." };
  try {
    const { relacao } = await obterRepositorios();
    await relacao.manuais.confirmarLeitura(v.data);
    revalidatePath("/manuais");
    revalidatePath("/treinamentos");
    return { sucesso: "Leitura confirmada. Obrigada." };
  } catch (erro) {
    return { erro: fraseErroRelacao(erro, "confirmar a leitura") };
  }
}

const esquemaTrilha = z.object({
  trilhaId: z.union([z.uuid(), z.literal("")]).default(""),
  nome: z.string().trim().min(3).max(120),
  papelAlvo: z.enum(PAPEIS),
  ativa: z.string().optional(),
});

/** Cria ou edita uma trilha de treinamento: uma lista ordenada de manuais (P51 item 2). */
export async function acaoSalvarTrilha(
  _anterior: EstadoAcaoRelacao,
  dados: FormData,
): Promise<EstadoAcaoRelacao> {
  await exigirSessao("/manuais");
  const lido = esquemaTrilha.safeParse(Object.fromEntries(dados.entries()));
  if (!lido.success)
    return { erro: "Confira o nome e o papel da trilha. Nada foi salvo." };
  const manualIds = dados
    .getAll("manualIds")
    .map(String)
    .filter((m) => z.uuid().safeParse(m).success);
  try {
    const { relacao } = await obterRepositorios();
    await relacao.manuais.salvarTrilha({
      trilhaId: lido.data.trilhaId || null,
      nome: lido.data.nome,
      papelAlvo: lido.data.papelAlvo,
      ativa: lido.data.ativa !== "nao",
      manualIds,
    });
    revalidatePath("/manuais");
    revalidatePath("/treinamentos");
    return { sucesso: "Trilha salva." };
  } catch (erro) {
    return { erro: fraseErroRelacao(erro, "salvar a trilha") };
  }
}
