"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { exigirSessao } from "@/lib/auth/sessao";
import { obterRepositorios } from "@/lib/dados/fabrica";
import type { PedidoAtualizarOcorrencia } from "@/lib/dados/tipos-ocorrencia";
import { origemPublicaDoApp } from "@/lib/integracoes/fabrica";
import type { EstadoAcaoOcorrencia } from "./estado-acoes";
import {
  fraseBloqueioPesquisa,
  fraseErroOcorrencia,
  fraseErroPesquisa,
} from "./mensagens";
import { ORDEM_STATUS, PRIORIDADES, TIPOS } from "./rotulos";

// Só funções assíncronas saem daqui ("use server"); estado e tipos em
// estado-acoes.ts.

const FRASE_TELA_VELHA = "Atualize a tela e tente de novo.";

function revalidar(): void {
  revalidatePath("/ocorrencias", "layout");
  revalidatePath("/pos-venda");
  revalidatePath("/tarefas");
  revalidatePath("/inicio");
}

const opcionalUuid = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .pipe(z.uuid().nullable());

/**
 * Abre uma ocorrência. Ocorrência de nota baixa na pesquisa é sempre privada
 * (PRD 7.4); o banco impõe. O SLA vem de `parametro.ocorrencia_sla` pela
 * prioridade, e a pessoa responsável, se escolhida, recebe um aviso.
 */
export async function acaoRegistrarOcorrencia(
  _anterior: EstadoAcaoOcorrencia,
  formulario: FormData,
): Promise<EstadoAcaoOcorrencia> {
  await exigirSessao("/ocorrencias");
  const campos: NonNullable<EstadoAcaoOcorrencia["campos"]> = {};

  const tipo = String(formulario.get("tipo") ?? "");
  if (!(TIPOS as readonly string[]).includes(tipo)) {
    campos.tipo = "Escolha o tipo da ocorrência.";
  }
  const prioridade = String(formulario.get("prioridade") ?? "normal");
  if (!(PRIORIDADES as readonly string[]).includes(prioridade)) {
    return { erro: FRASE_TELA_VELHA };
  }
  const titulo = String(formulario.get("titulo") ?? "").trim();
  if (titulo.length < 3 || titulo.length > 160) {
    campos.titulo = "Escreva um título com 3 a 160 caracteres.";
  }
  const descricao = String(formulario.get("descricao") ?? "").trim();
  if (descricao.length < 3 || descricao.length > 4000) {
    campos.descricao = "Escreva o que aconteceu, com até 4.000 caracteres.";
  }
  const familia = opcionalUuid.safeParse(formulario.get("familiaId") ?? "");
  const profissional = opcionalUuid.safeParse(
    formulario.get("profissionalId") ?? "",
  );
  const responsavel = opcionalUuid.safeParse(
    formulario.get("responsavelId") ?? "",
  );
  if (!familia.success) campos.familia = "Escolha uma família da lista.";
  if (!profissional.success || !responsavel.success) {
    return { erro: FRASE_TELA_VELHA };
  }
  if (Object.keys(campos).length > 0) {
    return { erro: "Falta alguma coisa para abrir a ocorrência.", campos };
  }

  let id: string;
  try {
    const { ocorrencias } = await obterRepositorios();
    const criada = await ocorrencias.registrar({
      familiaId: familia.success ? familia.data : null,
      profissionalId: profissional.data,
      tipo: tipo as (typeof TIPOS)[number],
      prioridade: prioridade as (typeof PRIORIDADES)[number],
      privada: formulario.get("privada") === "on",
      titulo,
      descricao,
      responsavelId: responsavel.data,
    });
    id = criada.id;
  } catch (erro) {
    return { erro: fraseErroOcorrencia(erro, "abrir a ocorrência") };
  }
  revalidar();
  redirect(`/ocorrencias/${id}`);
}

const esquemaAtualizar = z.object({
  ocorrenciaId: z.uuid(),
  status: z.enum(ORDEM_STATUS as [string, ...string[]]).optional(),
  responsavelId: z.uuid().nullable().optional(),
  prioridade: z.enum(PRIORIDADES as [string, ...string[]]).optional(),
  privada: z.boolean().optional(),
  nota: z.string().max(2000).optional(),
  versao: z.number().int().positive().nullable().optional(),
});

export interface PedidoAtualizarTela {
  ocorrenciaId: string;
  status?: string;
  responsavelId?: string | null;
  prioridade?: string;
  privada?: boolean;
  nota?: string;
  versao?: number | null;
}

/** Muda andamento, responsável, prioridade ou marca de privada, sempre com uma linha no histórico. */
export async function acaoAtualizarOcorrencia(
  pedido: PedidoAtualizarTela,
): Promise<EstadoAcaoOcorrencia> {
  await exigirSessao("/ocorrencias");
  const lido = esquemaAtualizar.safeParse(pedido);
  if (!lido.success) return { erro: FRASE_TELA_VELHA };
  const p = lido.data;
  try {
    const { ocorrencias } = await obterRepositorios();
    const resultado = await ocorrencias.atualizar({
      ocorrenciaId: p.ocorrenciaId,
      status: p.status as PedidoAtualizarOcorrencia["status"],
      responsavelId: p.responsavelId,
      prioridade: p.prioridade as PedidoAtualizarOcorrencia["prioridade"],
      privada: p.privada,
      nota: p.nota?.trim() || undefined,
      versaoBase: p.versao ?? null,
    });
    revalidar();
    return {
      sucesso: "Salvo no histórico da ocorrência.",
      versao: resultado.versao,
    };
  } catch (erro) {
    return { erro: fraseErroOcorrencia(erro, "salvar a ocorrência") };
  }
}

// --- Pós-venda (pipeline 4) ---------------------------------------------------------------

/** Endereço do app para montar o link: o configurado (APP_BASE_URL) ou o da requisição. */
async function enderecoDoApp(): Promise<string> {
  const cabecalhos = await headers();
  const host = cabecalhos.get("x-forwarded-host") ?? cabecalhos.get("host");
  const protocolo =
    cabecalhos.get("x-forwarded-proto") ??
    (host?.startsWith("127.0.0.1") || host?.startsWith("localhost")
      ? "http"
      : "https");
  return origemPublicaDoApp(`${protocolo}://${host ?? "localhost"}`);
}

/** Gera o link único da pesquisa e devolve o texto pronto para a coordenação copiar. */
export async function acaoGerarLinkPesquisa(
  posVendaId: string,
): Promise<EstadoAcaoOcorrencia> {
  await exigirSessao("/pos-venda");
  const id = z.uuid().safeParse(posVendaId);
  if (!id.success) return { erro: FRASE_TELA_VELHA };
  try {
    const { posVenda } = await obterRepositorios();
    const r = await posVenda.gerarLink(id.data);
    if (r.bloqueado) {
      return { erro: fraseBloqueioPesquisa(r.motivo) };
    }
    const link = `${await enderecoDoApp()}/pesquisa/${r.token}`;
    const texto = r.texto
      ? r.texto.replace(/@@LINK@@/g, link)
      : `Segue o link da pesquisa: ${link}`;
    revalidar();
    return {
      sucesso:
        "Link gerado. Copie o texto e mande pelo WhatsApp da coordenação, depois toque em Marcar como enviada.",
      texto,
    };
  } catch (erro) {
    return { erro: fraseErroPesquisa(erro, "gerar o link da pesquisa") };
  }
}

export async function acaoMarcarPesquisaEnviada(
  posVendaId: string,
): Promise<EstadoAcaoOcorrencia> {
  await exigirSessao("/pos-venda");
  const id = z.uuid().safeParse(posVendaId);
  if (!id.success) return { erro: FRASE_TELA_VELHA };
  try {
    const { posVenda } = await obterRepositorios();
    await posVenda.marcarEnviada(id.data);
  } catch (erro) {
    return { erro: fraseErroPesquisa(erro, "marcar a pesquisa como enviada") };
  }
  revalidar();
  return {
    sucesso:
      "Pesquisa marcada como enviada. Quando a família responder, o resultado aparece aqui.",
  };
}

export async function acaoAvancarPosVenda(
  posVendaId: string,
): Promise<EstadoAcaoOcorrencia> {
  await exigirSessao("/pos-venda");
  const id = z.uuid().safeParse(posVendaId);
  if (!id.success) return { erro: FRASE_TELA_VELHA };
  try {
    const { posVenda } = await obterRepositorios();
    await posVenda.avancar(id.data);
  } catch (erro) {
    return { erro: fraseErroPesquisa(erro, "avançar o pós-venda") };
  }
  revalidar();
  return { sucesso: "Pós-venda avançou para o próximo passo." };
}
