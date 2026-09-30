"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigirSessao } from "@/lib/auth/sessao";
import { obterRepositorios } from "@/lib/dados/fabrica";
import type {
  EspecialidadeMedico,
  EstadoParceiro,
} from "@/lib/dados/tipos-relacao";
import {
  fraseErroRelacao,
  type EstadoAcaoRelacao,
} from "@/modules/relacao/frases";

const texto = (max: number) => z.string().trim().max(max).default("");

const esquemaParceiro = z.object({
  medicoId: z.union([z.uuid(), z.literal("")]).default(""),
  nome: z.string().trim().min(2).max(120),
  especialidade: z.enum(["obstetra", "pediatra", "outro"]),
  telefone: texto(30),
  email: texto(200),
  hospital: texto(120),
  estado: z
    .enum(["prospeccao", "ativo", "pausado", "encerrado"])
    .default("prospeccao"),
  observacao: texto(1000),
  proximoContatoEm: z
    .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal("")])
    .default(""),
});

/** Cadastra ou edita um médico parceiro (P50). Sem campo de valor, de propósito. */
export async function acaoSalvarParceiro(
  _anterior: EstadoAcaoRelacao,
  dados: FormData,
): Promise<EstadoAcaoRelacao> {
  await exigirSessao("/parceiros");
  const lido = esquemaParceiro.safeParse(Object.fromEntries(dados.entries()));
  if (!lido.success) {
    return {
      erro: "Confira o nome e a especialidade do médico. Nada foi salvo.",
    };
  }
  try {
    const { relacao } = await obterRepositorios();
    await relacao.parceiros.salvar({
      medicoId: lido.data.medicoId || null,
      nome: lido.data.nome,
      especialidade: lido.data.especialidade as EspecialidadeMedico,
      telefone: lido.data.telefone,
      email: lido.data.email,
      hospital: lido.data.hospital,
      estado: lido.data.estado as EstadoParceiro,
      observacao: lido.data.observacao,
      proximoContatoEm: lido.data.proximoContatoEm || null,
    });
    revalidatePath("/parceiros");
    return { sucesso: "Médico parceiro salvo." };
  } catch (erro) {
    return { erro: fraseErroRelacao(erro, "salvar o médico") };
  }
}

const id = z.uuid();

/** Registra o contato de hoje e marca o próximo (P50). */
export async function acaoRegistrarContato(
  medicoId: string,
): Promise<EstadoAcaoRelacao> {
  await exigirSessao("/parceiros");
  const m = id.safeParse(medicoId);
  if (!m.success) return { erro: "Atualize a tela e tente de novo." };
  try {
    const { relacao } = await obterRepositorios();
    await relacao.parceiros.registrarContato(m.data, "");
    revalidatePath("/parceiros");
    return {
      sucesso: "Contato de hoje registrado. O próximo já está marcado.",
    };
  } catch (erro) {
    return { erro: fraseErroRelacao(erro, "registrar o contato") };
  }
}

const esquemaTarefa = z.object({
  medicoId: z.uuid(),
  titulo: z.string().trim().min(3).max(120),
  venceEm: z
    .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal("")])
    .default(""),
});

/** Tarefa de relacionamento com um médico parceiro (P50). */
export async function acaoCriarTarefaParceiro(
  _anterior: EstadoAcaoRelacao,
  dados: FormData,
): Promise<EstadoAcaoRelacao> {
  await exigirSessao("/parceiros");
  const lido = esquemaTarefa.safeParse(Object.fromEntries(dados.entries()));
  if (!lido.success)
    return {
      erro: "Escreva o que fazer, com 3 a 120 letras. Nada foi criado.",
    };
  try {
    const { relacao } = await obterRepositorios();
    await relacao.parceiros.criarTarefa(
      lido.data.medicoId,
      lido.data.titulo,
      lido.data.venceEm || null,
    );
    revalidatePath("/parceiros");
    revalidatePath("/tarefas");
    return { sucesso: "Tarefa criada. Ela aparece em Tarefas." };
  } catch (erro) {
    return { erro: fraseErroRelacao(erro, "criar a tarefa") };
  }
}

const esquemaIndicacao = z.object({
  familiaId: z.uuid(),
  quem: z.string().regex(/^(medico|familia):[0-9a-f-]{36}$/),
  observacao: texto(500),
});

/** Registra quem indicou a família: médico parceiro ou família promotora (P50). */
export async function acaoRegistrarIndicacao(
  _anterior: EstadoAcaoRelacao,
  dados: FormData,
): Promise<EstadoAcaoRelacao> {
  await exigirSessao("/parceiros");
  const lido = esquemaIndicacao.safeParse(Object.fromEntries(dados.entries()));
  if (!lido.success)
    return { erro: "Escolha a família e quem indicou. Nada foi registrado." };
  const [tipo, quemId] = lido.data.quem.split(":") as [
    "medico" | "familia",
    string,
  ];
  try {
    const { relacao } = await obterRepositorios();
    const r = await relacao.parceiros.registrarIndicacao({
      familiaId: lido.data.familiaId,
      medicoId: tipo === "medico" ? quemId : null,
      familiaPromotoraId: tipo === "familia" ? quemId : null,
      observacao: lido.data.observacao,
    });
    revalidatePath("/parceiros");
    revalidatePath("/marketing");
    return {
      sucesso:
        r.origem === "indicacao_medica"
          ? "Indicação registrada. A família passa a ter a origem indicação de médico."
          : "Indicação registrada. A família passa a ter a origem indicação de família.",
    };
  } catch (erro) {
    return { erro: fraseErroRelacao(erro, "registrar a indicação") };
  }
}
