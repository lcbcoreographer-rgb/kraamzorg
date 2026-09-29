"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { exigirSessao } from "@/lib/auth/sessao";
import { obterRepositorios } from "@/lib/dados/fabrica";
import type { DesfechoSessao } from "@/lib/dados/tipos-venda";
import type { EstadoAcaoSessao, ResultadoGerarResumo } from "./estado-acoes";
import { gerarResumoIa, resumoIaLigado } from "./ia";
import { fraseErroSessao } from "./mensagens";
import { resumoParaSalvar } from "./resumo";

// Só funções assíncronas saem daqui ("use server"); estado e tipos em
// estado-acoes.ts.

/**
 * Data e hora digitadas no fuso de Brasília (sem horário de verão desde
 * 2019, então o deslocamento é fixo em -03:00) para o instante ISO.
 */
function instanteBrasilia(data: string, hora: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || !/^\d{2}:\d{2}$/.test(hora)) {
    return null;
  }
  const instante = new Date(`${data}T${hora}:00-03:00`);
  return Number.isNaN(instante.getTime()) ? null : instante.toISOString();
}

function texto(formulario: FormData, campo: string): string {
  const valor = formulario.get(campo);
  return typeof valor === "string" ? valor.trim() : "";
}

function revalidarSessao(sessaoId?: string) {
  revalidatePath("/sessoes-venda");
  if (sessaoId) revalidatePath(`/sessoes-venda/${sessaoId}`);
  revalidatePath("/pipeline");
  revalidatePath("/tarefas");
  revalidatePath("/transferencias");
}

const esquemaAgendar = z.object({
  familiaId: z.uuid(),
  transferenciaId: z.uuid().nullable(),
  data: z.string().min(1, "Escolha o dia da conversa."),
  hora: z.string().min(1, "Escolha o horário da conversa."),
  conduzidaPor: z.uuid("Escolha quem conduz a conversa."),
  linkReuniao: z.string().min(1, "Cole o link da reunião."),
  opcoes: z.string().max(500).nullable(),
});

/**
 * Marca a conversa de orientação (P29 item 1). O banco move o P1 para
 * "Sessão agendada", resolve a transferência "reuniao" e cria o lembrete
 * da véspera (se o freio deixar), tudo numa transação.
 */
export async function acaoAgendarSessao(
  _anterior: EstadoAcaoSessao,
  formulario: FormData,
): Promise<EstadoAcaoSessao> {
  await exigirSessao("/sessoes-venda");
  const dados = esquemaAgendar.safeParse({
    familiaId: texto(formulario, "familiaId"),
    transferenciaId: texto(formulario, "transferenciaId") || null,
    data: texto(formulario, "data"),
    hora: texto(formulario, "hora"),
    conduzidaPor: texto(formulario, "conduzidaPor"),
    linkReuniao: texto(formulario, "linkReuniao"),
    opcoes: texto(formulario, "opcoes") || null,
  });
  if (!dados.success) {
    const campos: Record<string, string> = {};
    for (const problema of dados.error.issues) {
      const campo = String(problema.path[0] ?? "");
      campos[campo] ??= problema.message;
    }
    return { erro: "Falta um dado para marcar a conversa.", campos };
  }
  const agendadaPara = instanteBrasilia(dados.data.data, dados.data.hora);
  if (!agendadaPara) {
    return {
      erro: "Falta um dado para marcar a conversa.",
      campos: { data: "Confira o dia e o horário." },
    };
  }

  let sessaoId: string;
  try {
    const { venda } = await obterRepositorios();
    const resultado = await venda.agendarSessao({
      familiaId: dados.data.familiaId,
      agendadaPara,
      conduzidaPor: dados.data.conduzidaPor,
      linkReuniao: dados.data.linkReuniao,
      opcoesInformadas: dados.data.opcoes,
      handoffId: dados.data.transferenciaId,
    });
    sessaoId = resultado.sessaoId;
  } catch (erro) {
    return { erro: fraseErroSessao(erro, "marcar a conversa") };
  }

  revalidarSessao(sessaoId);
  revalidatePath(`/familias/${dados.data.familiaId}`);
  redirect(`/sessoes-venda/${sessaoId}?feito=marcada`);
}

const esquemaRemarcar = z.object({
  sessaoId: z.uuid(),
  data: z.string().min(1, "Escolha o novo dia."),
  hora: z.string().min(1, "Escolha o novo horário."),
  conduzidaPor: z.uuid().nullable(),
  linkReuniao: z.string().nullable(),
});

export async function acaoRemarcarSessao(
  _anterior: EstadoAcaoSessao,
  formulario: FormData,
): Promise<EstadoAcaoSessao> {
  await exigirSessao("/sessoes-venda");
  const dados = esquemaRemarcar.safeParse({
    sessaoId: texto(formulario, "sessaoId"),
    data: texto(formulario, "data"),
    hora: texto(formulario, "hora"),
    conduzidaPor: texto(formulario, "conduzidaPor") || null,
    linkReuniao: texto(formulario, "linkReuniao") || null,
  });
  if (!dados.success) {
    return {
      erro: dados.error.issues[0]?.message ?? "Confira o novo dia e o horário.",
    };
  }
  const agendadaPara = instanteBrasilia(dados.data.data, dados.data.hora);
  if (!agendadaPara) return { erro: "Confira o novo dia e o horário." };

  let novaId: string;
  try {
    const { venda } = await obterRepositorios();
    const resultado = await venda.remarcarSessao({
      sessaoId: dados.data.sessaoId,
      agendadaPara,
      conduzidaPor: dados.data.conduzidaPor,
      linkReuniao: dados.data.linkReuniao,
    });
    novaId = resultado.sessaoId;
  } catch (erro) {
    return { erro: fraseErroSessao(erro, "remarcar a conversa") };
  }

  revalidarSessao(dados.data.sessaoId);
  redirect(`/sessoes-venda/${novaId}?feito=remarcada`);
}

const DESFECHOS = ["realizada", "nao_compareceu", "cancelada"] as const;

const esquemaDesfecho = z.object({
  sessaoId: z.uuid(),
  desfecho: z.enum(DESFECHOS, "Escolha como foi a conversa."),
  parceiroPresente: z.enum(["sim", "nao", ""]),
});

/** Como foi a conversa (P29 item 2): estados e tarefas de retorno. */
export async function acaoRegistrarDesfecho(
  _anterior: EstadoAcaoSessao,
  formulario: FormData,
): Promise<EstadoAcaoSessao> {
  await exigirSessao("/sessoes-venda");
  const dados = esquemaDesfecho.safeParse({
    sessaoId: texto(formulario, "sessaoId"),
    desfecho: texto(formulario, "desfecho"),
    parceiroPresente: texto(formulario, "parceiroPresente"),
  });
  if (!dados.success) {
    return {
      erro: dados.error.issues[0]?.message ?? "Escolha como foi a conversa.",
    };
  }
  const desfecho: DesfechoSessao = dados.data.desfecho;
  const parceiro =
    dados.data.parceiroPresente === ""
      ? null
      : dados.data.parceiroPresente === "sim";

  let tarefaCriada: boolean;
  try {
    const { venda } = await obterRepositorios();
    const resultado = await venda.registrarDesfecho(
      dados.data.sessaoId,
      desfecho,
      desfecho === "realizada" ? parceiro : null,
    );
    tarefaCriada = resultado.tarefaId !== null;
  } catch (erro) {
    return { erro: fraseErroSessao(erro, "registrar como foi a conversa") };
  }

  revalidarSessao(dados.data.sessaoId);
  if (desfecho === "cancelada") {
    return {
      sucesso: "Conversa cancelada. O lembrete da véspera saiu das tarefas.",
    };
  }
  if (!tarefaCriada) {
    return {
      sucesso:
        "Registrado. Nenhuma mensagem foi sugerida porque a família está com o freio ou pediu para não ser contatada.",
    };
  }
  return {
    sucesso:
      desfecho === "realizada"
        ? "Registrado. A tarefa de perguntar à família como foi já está nas tarefas, com o texto pronto e o prazo do retorno."
        : "Registrado. A tarefa de oferecer outro horário já está nas suas tarefas, com o texto pronto.",
  };
}

const esquemaGravacao = z.object({
  sessaoId: z.uuid(),
  consentimento: z.enum(
    ["sim", "nao"],
    "Diga se a família autorizou a gravação.",
  ),
  transcricao: z.string(),
});

/** Consentimento e transcrição (P29 item 3), em sessao_venda_gravacao. */
export async function acaoRegistrarGravacao(
  _anterior: EstadoAcaoSessao,
  formulario: FormData,
): Promise<EstadoAcaoSessao> {
  await exigirSessao("/sessoes-venda");
  const dados = esquemaGravacao.safeParse({
    sessaoId: texto(formulario, "sessaoId"),
    consentimento: texto(formulario, "consentimento"),
    transcricao: texto(formulario, "transcricao"),
  });
  if (!dados.success) {
    return {
      erro:
        dados.error.issues[0]?.message ??
        "Diga se a família autorizou a gravação.",
    };
  }
  const autorizou = dados.data.consentimento === "sim";
  try {
    const { venda } = await obterRepositorios();
    await venda.registrarGravacao(
      dados.data.sessaoId,
      autorizou,
      autorizou ? dados.data.transcricao || null : null,
    );
  } catch (erro) {
    return { erro: fraseErroSessao(erro, "guardar a gravação") };
  }

  revalidatePath(`/sessoes-venda/${dados.data.sessaoId}`);
  if (!autorizou) {
    return {
      sucesso:
        "Registrado que a família não autorizou. Nada da conversa fica guardado.",
    };
  }
  return {
    sucesso: dados.data.transcricao
      ? "Transcrição guardada. Só quem conduziu e a diretoria conseguem abrir."
      : "Consentimento registrado. Cole a transcrição quando tiver.",
  };
}

/**
 * Pede o resumo à IA (só no servidor). Lê a transcrição pelo repositório,
 * o que confere de novo quem pode e registra a leitura. Nada é salvo aqui:
 * a pessoa revisa e salva com acaoSalvarResumo.
 */
export async function acaoGerarResumo(
  sessaoId: string,
): Promise<ResultadoGerarResumo> {
  await exigirSessao("/sessoes-venda");
  if (!z.uuid().safeParse(sessaoId).success) {
    return {
      ok: false,
      erro: "Não deu para saber qual conversa. Atualize a tela.",
    };
  }
  if (!resumoIaLigado()) {
    return {
      ok: false,
      erro: "O resumo automático está desligado neste ambiente. Escreva o resumo nos campos abaixo; ele fica guardado do mesmo jeito.",
    };
  }
  let transcricao: string | null;
  try {
    const { venda } = await obterRepositorios();
    transcricao = (await venda.obterGravacao(sessaoId))?.transcricao ?? null;
  } catch (erro) {
    return { ok: false, erro: fraseErroSessao(erro, "ler a transcrição") };
  }
  if (!transcricao) {
    return { ok: false, erro: "Cole a transcrição antes de pedir o resumo." };
  }

  const resultado = await gerarResumoIa(transcricao);
  if (!resultado.ok) {
    return {
      ok: false,
      erro: "O resumo automático não respondeu agora. A transcrição continua guardada; tente de novo em instantes ou escreva o resumo à mão.",
    };
  }
  return {
    ok: true,
    resumo: {
      ...resultado.resumo,
      descartados: resultado.descartados,
      modelo: resultado.modelo,
    },
  };
}

const esquemaResumo = z.object({
  sessaoId: z.uuid(),
  duvidas: z.string().max(5000),
  objecoes: z.string().max(5000),
  planoInteresse: z.string().max(300),
  proximosPassos: z.string().max(5000),
  origem: z.enum(["ia", "pessoa"]),
  modelo: z.string().max(100),
});

export async function acaoSalvarResumo(
  _anterior: EstadoAcaoSessao,
  formulario: FormData,
): Promise<EstadoAcaoSessao> {
  await exigirSessao("/sessoes-venda");
  const dados = esquemaResumo.safeParse({
    sessaoId: texto(formulario, "sessaoId"),
    duvidas: texto(formulario, "duvidas"),
    objecoes: texto(formulario, "objecoes"),
    planoInteresse: texto(formulario, "planoInteresse"),
    proximosPassos: texto(formulario, "proximosPassos"),
    origem: texto(formulario, "origem") || "pessoa",
    modelo: texto(formulario, "modelo"),
  });
  if (!dados.success) {
    return {
      erro: "O resumo ficou grande demais. Encurte os itens e salve de novo.",
    };
  }
  const resumo = resumoParaSalvar(
    dados.data,
    dados.data.origem,
    dados.data.modelo || null,
  );
  try {
    const { venda } = await obterRepositorios();
    await venda.salvarResumo(dados.data.sessaoId, resumo);
  } catch (erro) {
    return { erro: fraseErroSessao(erro, "salvar o resumo") };
  }
  revalidatePath(`/sessoes-venda/${dados.data.sessaoId}`);
  return {
    sucesso:
      "Resumo salvo junto da transcrição, com o mesmo acesso: quem conduziu e a diretoria.",
  };
}
