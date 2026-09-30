import { ErroRepositorio } from "@/lib/dados/erros";
import type { OperacaoRepositorio } from "@/lib/dados/repositorios";
import type { Json } from "@/lib/db/types";
import { separarCaminho } from "@/lib/instrumentos/respostas";
import type {
  ItemSincronizacaoEntrada,
  ResultadoItemSincronizacao,
} from "./tipos";

/**
 * Sincronização da consulta pré-natal (DOC 1, P35): a `consulta_prenatal` é a
 * primeira entidade do motor offline (P12) com repositório de verdade. Cada
 * item da fila é um campo da entrevista ("B.percentil") ou a marca de onde a
 * pessoa parou ("__progresso"); o servidor aplica um por vez, na ordem de
 * criação, pela função `api.prenatal_salvar_campo`, que confere papel e
 * AAL2, compara a versão (conflito com o original preservado) e é
 * idempotente pelo id do item (reenviar nunca reaplica).
 */

/** `campo` do item que guarda onde a pessoa parou: payload `{ etapa, campo? }`. */
export const CAMPO_PROGRESSO = "__progresso";

/** Endereço "bloco.campo" do item de fila do DOC 1. */
export function campoPrenatal(bloco: string, campo: string): string {
  return `${bloco}.${campo}`;
}

function ordenar(itens: readonly ItemSincronizacaoEntrada[]) {
  return [...itens].sort((a, b) => {
    const dif =
      Date.parse(a.criadoNoClienteEm) - Date.parse(b.criadoNoClienteEm);
    return dif !== 0 ? dif : a.id.localeCompare(b.id);
  });
}

function progressoDoPayload(
  payload: unknown,
): { etapa: number; campo: string | null } | null {
  if (!payload || typeof payload !== "object") return null;
  const { etapa, campo } = payload as { etapa?: unknown; campo?: unknown };
  if (typeof etapa !== "number" || !Number.isInteger(etapa) || etapa < 1) {
    return null;
  }
  return { etapa, campo: typeof campo === "string" ? campo : null };
}

async function processarItem(
  item: ItemSincronizacaoEntrada,
  operacao: OperacaoRepositorio,
): Promise<ResultadoItemSincronizacao> {
  if (item.entidade !== "consulta_prenatal") {
    return { id: item.id, status: "erro", erro: "entidade fora desta rota" };
  }
  if (item.entidadeId === null || item.campo === null) {
    return {
      id: item.id,
      status: "erro",
      erro: "a consulta e o campo são obrigatórios",
    };
  }

  let pedido: Parameters<OperacaoRepositorio["salvarCampo"]>[0];
  if (item.campo === CAMPO_PROGRESSO) {
    const progresso = progressoDoPayload(item.payload);
    if (!progresso) {
      return { id: item.id, status: "erro", erro: "progresso inválido" };
    }
    pedido = {
      consultaId: item.entidadeId,
      bloco: null,
      campo: null,
      valor: null,
      versaoBase: item.versaoBase,
      progresso,
      itemId: item.id,
    };
  } else {
    if (!item.campo.includes(".")) {
      return { id: item.id, status: "erro", erro: "campo sem bloco" };
    }
    const { bloco, campo } = separarCaminho(item.campo);
    pedido = {
      consultaId: item.entidadeId,
      bloco,
      campo,
      valor: (item.payload ?? null) as Json | null,
      versaoBase: item.versaoBase,
      itemId: item.id,
    };
  }

  try {
    const r = await operacao.salvarCampo(pedido);
    if (r.conflito) {
      return {
        id: item.id,
        status: "conflito",
        conflito: {
          original: r.original,
          versaoAtual: r.versao,
          tentativa: item.payload,
        },
      };
    }
    return { id: item.id, status: "processado", versaoResultante: r.versao };
  } catch (erro) {
    // Recusa de negócio e falta de permissão viram "erro" do item, sem
    // derrubar o lote; o detalhe técnico não sobe para o aparelho.
    if (erro instanceof ErroRepositorio) {
      return {
        id: item.id,
        status: "erro",
        erro:
          erro.codigo === "sem_permissao"
            ? "sem permissão para gravar esta entrevista"
            : erro.codigo === "recusado"
              ? "o servidor recusou este campo"
              : "o servidor não respondeu agora",
      };
    }
    throw erro;
  }
}

/** Aplica os itens da consulta pré-natal, na ordem de criação, um de cada vez. */
export async function processarItensPrenatal(
  itens: readonly ItemSincronizacaoEntrada[],
  operacao: OperacaoRepositorio,
): Promise<ResultadoItemSincronizacao[]> {
  const resultados: ResultadoItemSincronizacao[] = [];
  for (const item of ordenar(itens)) {
    resultados.push(await processarItem(item, operacao));
  }
  return resultados;
}
