"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigirSessao } from "@/lib/auth/sessao";
import { obterRepositorios } from "@/lib/dados/fabrica";
import {
  ESTADOS_CANDIDATA,
  type EstadoCandidata,
} from "@/lib/dados/tipos-relacao";
import {
  fraseErroRelacao,
  type EstadoAcaoRelacao,
} from "@/modules/relacao/frases";

const texto = (max: number) => z.string().trim().max(max).default("");

const esquemaCandidata = z.object({
  candidataId: z.union([z.uuid(), z.literal("")]).default(""),
  nome: z.string().trim().min(3).max(120),
  telefone: texto(30),
  email: texto(200),
  cidade: texto(80),
  conselho: texto(60),
  apresentacao: texto(1500),
  observacoes: texto(1000),
});

/** Cadastra ou edita uma candidata no banco de talentos (P51 item 3). */
export async function acaoSalvarCandidata(
  _anterior: EstadoAcaoRelacao,
  dados: FormData,
): Promise<EstadoAcaoRelacao> {
  await exigirSessao("/talentos");
  const lido = esquemaCandidata.safeParse(Object.fromEntries(dados.entries()));
  if (!lido.success)
    return { erro: "Confira o nome da candidata. Nada foi salvo." };
  try {
    const { relacao } = await obterRepositorios();
    const id = await relacao.talentos.salvar({
      candidataId: lido.data.candidataId || null,
      nome: lido.data.nome,
      telefone: lido.data.telefone,
      email: lido.data.email,
      cidade: lido.data.cidade,
      conselho: lido.data.conselho,
      apresentacao: lido.data.apresentacao,
      observacoes: lido.data.observacoes,
    });
    revalidatePath("/talentos");
    revalidatePath(`/talentos/${id}`);
    return { sucesso: "Candidata salva." };
  } catch (erro) {
    return { erro: fraseErroRelacao(erro, "salvar a candidata") };
  }
}

/** Muda a etapa da candidata no processo de seleção (P51 item 3). */
export async function acaoMudarEstadoCandidata(
  candidataId: string,
  estado: string,
): Promise<EstadoAcaoRelacao> {
  await exigirSessao("/talentos");
  const id = z.uuid().safeParse(candidataId);
  if (
    !id.success ||
    !(ESTADOS_CANDIDATA as readonly string[]).includes(estado)
  ) {
    return { erro: "Atualize a tela e tente de novo." };
  }
  try {
    const { relacao } = await obterRepositorios();
    await relacao.talentos.mudarEstado(id.data, estado as EstadoCandidata);
    revalidatePath("/talentos");
    revalidatePath(`/talentos/${id.data}`);
    return { sucesso: "Etapa atualizada." };
  } catch (erro) {
    return { erro: fraseErroRelacao(erro, "mudar a etapa") };
  }
}

/**
 * Entrevista: as respostas do roteiro de 26 perguntas e as notas de 1 a 5 dos
 * 10 critérios. Os campos são `resposta:<id>` e `nota:<id>`; o banco confere
 * que cada id existe no roteiro vigente. Nota em branco fica sem nota.
 */
export async function acaoAvaliarCandidata(
  _anterior: EstadoAcaoRelacao,
  dados: FormData,
): Promise<EstadoAcaoRelacao> {
  await exigirSessao("/talentos");
  const id = z.uuid().safeParse(String(dados.get("candidataId") ?? ""));
  if (!id.success) return { erro: "Atualize a tela e tente de novo." };
  const respostas: Record<string, string> = {};
  const notas: Record<string, number> = {};
  for (const [chave, valor] of dados.entries()) {
    if (typeof valor !== "string") continue;
    if (chave.startsWith("resposta:")) {
      const t = valor.trim();
      if (t) respostas[chave.slice(9)] = t.slice(0, 2000);
    } else if (chave.startsWith("nota:")) {
      if (valor.trim() === "") continue;
      const n = Number(valor);
      if (!Number.isInteger(n) || n < 1 || n > 5) {
        return { erro: "A nota é um número inteiro de 1 a 5. Nada foi salvo." };
      }
      notas[chave.slice(5)] = n;
    }
  }
  const observacoes = String(dados.get("observacoes") ?? "")
    .trim()
    .slice(0, 1500);
  try {
    const { relacao } = await obterRepositorios();
    const r = await relacao.talentos.avaliar({
      candidataId: id.data,
      respostas,
      notas,
      observacoes,
    });
    revalidatePath("/talentos");
    revalidatePath(`/talentos/${id.data}`);
    return {
      sucesso: r.completa
        ? `Avaliação salva. Média ${r.media?.toFixed(1).replace(".", ",") ?? ""} nos ${r.criteriosTotal} critérios.`
        : `Avaliação salva com ${r.criteriosAvaliados} de ${r.criteriosTotal} critérios. Você pode completar depois.`,
    };
  } catch (erro) {
    return { erro: fraseErroRelacao(erro, "salvar a avaliação") };
  }
}
