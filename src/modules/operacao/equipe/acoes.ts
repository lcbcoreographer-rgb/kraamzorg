"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { eDataValida, horaCurta } from "@/lib/agenda/datas";
import { exigirSessao } from "@/lib/auth/sessao";
import { obterRepositorios } from "@/lib/dados/fabrica";
import type { VinculoProfissional } from "@/lib/dados/tipos-equipe";
import type {
  EstadoAcaoEquipe,
  ResultadoVerificacaoCascata,
  ResultadoVerificacaoVisita,
} from "./estado-acoes";
import { fraseErroEquipe } from "./textos";
import { centavosDoTexto } from "./valores";

// Só funções assíncronas saem daqui ("use server"); estado e tipos em
// estado-acoes.ts.

function texto(formulario: FormData, campo: string): string {
  const valor = formulario.get(campo);
  return typeof valor === "string" ? valor.trim() : "";
}

function camposDoErro(erro: z.ZodError): Record<string, string> {
  const campos: Record<string, string> = {};
  for (const problema of erro.issues) {
    const campo = String(problema.path[0] ?? "");
    campos[campo] ??= problema.message;
  }
  return campos;
}

function revalidarEquipe(profissionalId?: string) {
  revalidatePath("/equipe");
  revalidatePath("/equipe/escala");
  revalidatePath("/agenda");
  revalidatePath("/inicio");
  if (profissionalId) revalidatePath(`/equipe/${profissionalId}`);
}

// --- Cadastro da profissional ---------------------------------------------------

const VINCULOS = [
  "clt",
  "pj",
  "mei",
  "autonoma",
  "socia",
  "a_definir",
] as const;

const esquemaProfissional = z.object({
  id: z.uuid().nullable(),
  nome: z
    .string()
    .min(1, "Escreva o nome da profissional.")
    .max(120, "O nome está grande demais."),
  funcao: z.string().min(1, "Escolha a função."),
  vinculo: z.enum(VINCULOS, "Escolha o vínculo."),
  conselhoUf: z.string().nullable(),
  conselhoNumero: z.string().nullable(),
  telefone: z.string().nullable(),
  regioes: z.array(z.uuid()).min(1, "Escolha ao menos uma região."),
  usuarioId: z.uuid().nullable(),
});

/**
 * Cadastra ou altera uma profissional (P37 item 1). O banco valida de novo
 * (função, telefone E.164, região, conselho, valores) e mantém a ligação com
 * o acesso; desativar corta o acesso da enfermeira na hora.
 */
export async function acaoSalvarProfissional(
  _anterior: EstadoAcaoEquipe,
  formulario: FormData,
): Promise<EstadoAcaoEquipe> {
  await exigirSessao("/equipe");
  const dados = esquemaProfissional.safeParse({
    id: texto(formulario, "id") || null,
    nome: texto(formulario, "nome"),
    funcao: texto(formulario, "funcao"),
    vinculo: texto(formulario, "vinculo"),
    conselhoUf: texto(formulario, "conselhoUf") || null,
    conselhoNumero: texto(formulario, "conselhoNumero") || null,
    telefone: texto(formulario, "telefone") || null,
    regioes: formulario
      .getAll("regioes")
      .filter((v): v is string => typeof v === "string"),
    usuarioId: texto(formulario, "usuarioId") || null,
  });
  if (!dados.success) {
    return {
      erro: "Falta um dado no cadastro.",
      campos: camposDoErro(dados.error),
    };
  }
  const valorHora = centavosDoTexto(texto(formulario, "valorHora"));
  const adicional = centavosDoTexto(texto(formulario, "adicionalDeslocamento"));
  const campos: Record<string, string> = {};
  if (Number.isNaN(valorHora))
    campos.valorHora = "Escreva o valor em reais, por exemplo 100 ou 100,50.";
  if (Number.isNaN(adicional))
    campos.adicionalDeslocamento =
      "Escreva o valor em reais, por exemplo 100 ou 100,50.";
  if (Object.keys(campos).length > 0)
    return { erro: "Confira os valores.", campos };

  const ativa = texto(formulario, "ativa") !== "nao";
  let resultado: { id: string; nova: boolean };
  try {
    const { equipe } = await obterRepositorios();
    resultado = await equipe.salvarProfissional({
      id: dados.data.id,
      nome: dados.data.nome,
      funcao: dados.data.funcao,
      conselhoUf: dados.data.conselhoUf,
      conselhoNumero: dados.data.conselhoNumero,
      telefoneE164: dados.data.telefone,
      regioes: dados.data.regioes,
      vinculo: dados.data.vinculo as VinculoProfissional,
      valorHoraCentavos: valorHora,
      adicionalDeslocamentoCentavos: adicional ?? 0,
      ativa,
      usuarioId: dados.data.usuarioId,
    });
  } catch (erro) {
    return { erro: fraseErroEquipe(erro, "salvar o cadastro") };
  }
  revalidarEquipe(resultado.id);
  redirect(
    `/equipe/${resultado.id}?feito=${resultado.nova ? "criada" : "salva"}`,
  );
}

// --- Documentos com validade ------------------------------------------------------

const esquemaDocumento = z.object({
  id: z.uuid().nullable(),
  profissionalId: z.uuid(),
  tipo: z
    .string()
    .min(1, "Escreva o tipo do documento.")
    .max(80, "O tipo está grande demais."),
  numero: z.string().max(80).nullable(),
  validade: z.string().nullable(),
});

export async function acaoSalvarDocumento(
  _anterior: EstadoAcaoEquipe,
  formulario: FormData,
): Promise<EstadoAcaoEquipe> {
  await exigirSessao("/equipe");
  const dados = esquemaDocumento.safeParse({
    id: texto(formulario, "id") || null,
    profissionalId: texto(formulario, "profissionalId"),
    tipo: texto(formulario, "tipo"),
    numero: texto(formulario, "numero") || null,
    validade: texto(formulario, "validade") || null,
  });
  if (!dados.success) {
    return {
      erro: "Falta um dado no documento.",
      campos: camposDoErro(dados.error),
    };
  }
  if (dados.data.validade && !eDataValida(dados.data.validade)) {
    return {
      erro: "Confira a validade.",
      campos: { validade: "Escolha uma data válida." },
    };
  }
  try {
    const { equipe } = await obterRepositorios();
    await equipe.salvarDocumento({
      id: dados.data.id,
      profissionalId: dados.data.profissionalId,
      tipo: dados.data.tipo,
      numero: dados.data.numero,
      validade: dados.data.validade,
    });
  } catch (erro) {
    return { erro: fraseErroEquipe(erro, "salvar o documento") };
  }
  revalidarEquipe(dados.data.profissionalId);
  return {
    sucesso: "Documento salvo. A coordenação é avisada antes de ele vencer.",
  };
}

// --- Bloqueios de agenda ------------------------------------------------------------

const esquemaBloqueio = z.object({
  id: z.uuid().nullable(),
  profissionalId: z.uuid(),
  inicio: z.string().refine(eDataValida, "Escolha o primeiro dia."),
  fim: z.string().refine(eDataValida, "Escolha o último dia."),
  motivo: z
    .string()
    .min(1, "Escreva o motivo.")
    .max(200, "O motivo está grande demais."),
});

export async function acaoSalvarBloqueio(
  _anterior: EstadoAcaoEquipe,
  formulario: FormData,
): Promise<EstadoAcaoEquipe> {
  await exigirSessao("/equipe");
  const dados = esquemaBloqueio.safeParse({
    id: texto(formulario, "id") || null,
    profissionalId: texto(formulario, "profissionalId"),
    inicio: texto(formulario, "inicio"),
    fim: texto(formulario, "fim"),
    motivo: texto(formulario, "motivo"),
  });
  if (!dados.success) {
    return {
      erro: "Falta um dado no bloqueio.",
      campos: camposDoErro(dados.error),
    };
  }
  if (dados.data.fim < dados.data.inicio) {
    return {
      erro: "Confira as datas.",
      campos: { fim: "O último dia não pode vir antes do primeiro." },
    };
  }
  try {
    const { equipe } = await obterRepositorios();
    const r = await equipe.salvarBloqueio(dados.data);
    revalidarEquipe(dados.data.profissionalId);
    return {
      sucesso:
        r.visitasAfetadas.length > 0
          ? "Bloqueio salvo. Há visitas marcadas nesses dias: reagende cada uma."
          : "Bloqueio salvo. Nenhuma visita cai nesses dias.",
      visitasAfetadas: r.visitasAfetadas,
    };
  } catch (erro) {
    return { erro: fraseErroEquipe(erro, "salvar o bloqueio") };
  }
}

export async function acaoRemoverBloqueio(
  _anterior: EstadoAcaoEquipe,
  formulario: FormData,
): Promise<EstadoAcaoEquipe> {
  await exigirSessao("/equipe");
  const id = texto(formulario, "id");
  const profissionalId = texto(formulario, "profissionalId");
  if (!z.uuid().safeParse(id).success)
    return { erro: "Não achamos este bloqueio." };
  try {
    const { equipe } = await obterRepositorios();
    await equipe.removerBloqueio(id);
  } catch (erro) {
    return { erro: fraseErroEquipe(erro, "remover o bloqueio") };
  }
  revalidarEquipe(profissionalId || undefined);
  return { sucesso: "Bloqueio removido." };
}

// --- Reagendamento -------------------------------------------------------------------

const esquemaReagendar = z.object({
  visitaId: z.uuid(),
  data: z.string().refine(eDataValida, "Escolha o dia."),
  hora: z.string().nullable(),
  profissionalId: z.uuid().nullable(),
  motivo: z.string().max(300).nullable(),
});

function lerReagendar(formulario: FormData) {
  return esquemaReagendar.safeParse({
    visitaId: texto(formulario, "visitaId"),
    data: texto(formulario, "data"),
    hora: horaCurta(texto(formulario, "hora")) ?? null,
    profissionalId: texto(formulario, "profissionalId") || null,
    motivo: texto(formulario, "motivo") || null,
  });
}

/**
 * Confere os conflitos de um reagendamento antes de salvar (P37 item 3):
 * chamada direto pelo formulário a cada mudança de dia, hora ou enfermeira.
 * Não grava nada.
 */
export async function verificarReagendamentoVisita(entrada: {
  visitaId: string;
  data: string;
  hora: string | null;
  profissionalId: string | null;
}): Promise<ResultadoVerificacaoVisita> {
  await exigirSessao("/agenda");
  const dados = esquemaReagendar.safeParse({
    visitaId: entrada.visitaId,
    data: entrada.data,
    hora: horaCurta(entrada.hora) ?? null,
    profissionalId: entrada.profissionalId || null,
    motivo: null,
  });
  if (!dados.success)
    return { ok: false, erro: "Escolha o dia para ver os conflitos." };
  try {
    const { equipe } = await obterRepositorios();
    const r = await equipe.reagendarVisita({
      visitaId: dados.data.visitaId,
      data: dados.data.data,
      horaPrevista: dados.data.hora,
      profissionalId: dados.data.profissionalId,
      simular: true,
    });
    return { ok: true, conflitos: r.conflitos };
  } catch (erro) {
    return { ok: false, erro: fraseErroEquipe(erro, "conferir a agenda") };
  }
}

export async function acaoReagendarVisita(
  _anterior: EstadoAcaoEquipe,
  formulario: FormData,
): Promise<EstadoAcaoEquipe> {
  await exigirSessao("/agenda");
  const dados = lerReagendar(formulario);
  if (!dados.success) {
    return {
      erro: "Falta um dado para reagendar.",
      campos: camposDoErro(dados.error),
    };
  }
  const confirmou = texto(formulario, "confirmarConflito") === "sim";
  if (confirmou && !dados.data.motivo) {
    return {
      erro: "Escreva o motivo para salvar com o conflito.",
      campos: { motivo: "Conte por que vale salvar assim." },
    };
  }
  try {
    const { equipe } = await obterRepositorios();
    await equipe.reagendarVisita({
      visitaId: dados.data.visitaId,
      data: dados.data.data,
      horaPrevista: dados.data.hora,
      profissionalId: dados.data.profissionalId,
      motivo: dados.data.motivo,
      forcar: confirmou,
    });
  } catch (erro) {
    return { erro: fraseErroEquipe(erro, "reagendar a visita") };
  }
  revalidarEquipe();
  redirect(`/agenda?data=${dados.data.data}&feito=reagendada`);
}

const esquemaCascata = z.object({
  acompanhamentoId: z.uuid(),
  novaDataInicio: z
    .string()
    .refine(eDataValida, "Escolha o novo primeiro dia."),
  motivo: z.string().max(300).nullable(),
});

export async function verificarCascata(entrada: {
  acompanhamentoId: string;
  novaDataInicio: string;
}): Promise<ResultadoVerificacaoCascata> {
  await exigirSessao("/agenda");
  const dados = esquemaCascata.safeParse({ ...entrada, motivo: null });
  if (!dados.success)
    return {
      ok: false,
      erro: "Escolha o novo primeiro dia para ver o resultado.",
    };
  try {
    const { equipe } = await obterRepositorios();
    const r = await equipe.reagendarCascata({
      acompanhamentoId: dados.data.acompanhamentoId,
      novaDataInicio: dados.data.novaDataInicio,
      simular: true,
    });
    return {
      ok: true,
      deslocamentoDias: r.deslocamentoDias,
      conflitosTotal: r.conflitosTotal,
      visitas: r.visitas,
    };
  } catch (erro) {
    return { ok: false, erro: fraseErroEquipe(erro, "conferir a agenda") };
  }
}

export async function acaoReagendarCascata(
  _anterior: EstadoAcaoEquipe,
  formulario: FormData,
): Promise<EstadoAcaoEquipe> {
  await exigirSessao("/agenda");
  const dados = esquemaCascata.safeParse({
    acompanhamentoId: texto(formulario, "acompanhamentoId"),
    novaDataInicio: texto(formulario, "novaDataInicio"),
    motivo: texto(formulario, "motivo") || null,
  });
  if (!dados.success) {
    return {
      erro: "Falta um dado para reagendar.",
      campos: camposDoErro(dados.error),
    };
  }
  const confirmou = texto(formulario, "confirmarConflito") === "sim";
  if (!dados.data.motivo) {
    return {
      erro: "Escreva o motivo da mudança.",
      campos: {
        motivo: "Conte o que mudou (nascimento, alta ou outro motivo).",
      },
    };
  }
  try {
    const { equipe } = await obterRepositorios();
    await equipe.reagendarCascata({
      acompanhamentoId: dados.data.acompanhamentoId,
      novaDataInicio: dados.data.novaDataInicio,
      motivo: dados.data.motivo,
      forcar: confirmou,
    });
  } catch (erro) {
    return { erro: fraseErroEquipe(erro, "reagendar as visitas") };
  }
  revalidarEquipe();
  redirect(`/agenda?data=${dados.data.novaDataInicio}&feito=cascata`);
}
