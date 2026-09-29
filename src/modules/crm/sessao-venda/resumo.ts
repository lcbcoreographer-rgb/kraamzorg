import type { ItemResumo, ResumoSessao } from "@/lib/dados/tipos-venda";

/**
 * Resumo da sessão de venda (P29 item 3): o que a IA devolve passa por
 * aqui antes de chegar à tela. "Sem inventar" vira regra verificável:
 * cada item precisa trazer um trecho copiado da transcrição, e o trecho
 * precisa estar lá de fato (comparado sem acento, caixa ou pontuação).
 * Item sem trecho, ou com trecho que não aparece, sai e é contado, para a
 * tela dizer quantos ficaram de fora. A pessoa revisa tudo antes de salvar.
 */

export interface ResumoRevisao {
  duvidas: ItemResumo[];
  objecoes: ItemResumo[];
  planoInteresse: ItemResumo | null;
  proximosPassos: ItemResumo[];
}

export interface ResumoVerificado {
  resumo: ResumoRevisao;
  descartados: number;
}

/** Tamanho mínimo do trecho, em caracteres já normalizados. */
const TRECHO_MINIMO = 8;

export function normalizarParaBusca(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function trechoConfere(trecho: string, transcricaoNormalizada: string) {
  const alvo = normalizarParaBusca(trecho);
  return alvo.length >= TRECHO_MINIMO && transcricaoNormalizada.includes(alvo);
}

function lerItem(valor: unknown): ItemResumo | null {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return null;
  const registro = valor as Record<string, unknown>;
  const texto = typeof registro.texto === "string" ? registro.texto.trim() : "";
  const trecho =
    typeof registro.trecho === "string" ? registro.trecho.trim() : "";
  if (!texto) return null;
  return { texto: texto.replace(/\s+/g, " "), trecho };
}

function lista(valor: unknown): unknown[] {
  return Array.isArray(valor) ? valor : [];
}

/**
 * Lê a saída da IA (o JSON pedido em resumo-sessao.md) e fica só com o que
 * a transcrição sustenta.
 */
export function verificarSaidaIa(
  saida: unknown,
  transcricao: string,
): ResumoVerificado {
  const registro =
    saida && typeof saida === "object" && !Array.isArray(saida)
      ? (saida as Record<string, unknown>)
      : {};
  const base = normalizarParaBusca(transcricao);
  let descartados = 0;

  const filtrar = (itens: unknown[]): ItemResumo[] => {
    const aceitos: ItemResumo[] = [];
    for (const bruto of itens) {
      const item = lerItem(bruto);
      if (item && item.trecho && trechoConfere(item.trecho, base)) {
        aceitos.push(item);
      } else if (bruto !== null && bruto !== undefined) {
        descartados += 1;
      }
    }
    return aceitos;
  };

  const plano = filtrar(
    registro.plano_interesse ? [registro.plano_interesse] : [],
  );

  return {
    resumo: {
      duvidas: filtrar(lista(registro.duvidas)),
      objecoes: filtrar(lista(registro.objecoes)),
      planoInteresse: plano[0] ?? null,
      proximosPassos: filtrar(lista(registro.proximos_passos)),
    },
    descartados,
  };
}

/** Uma linha por item, como a pessoa edita no formulário. */
export function linhas(texto: string): string[] {
  return texto
    .split(/\r?\n/)
    .map((linha) => linha.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean);
}

export function resumoParaSalvar(
  campos: {
    duvidas: string;
    objecoes: string;
    planoInteresse: string;
    proximosPassos: string;
  },
  origem: ResumoSessao["origem"],
  modelo: string | null,
): ResumoSessao {
  return {
    duvidas: linhas(campos.duvidas),
    objecoes: linhas(campos.objecoes),
    planoInteresse: campos.planoInteresse.trim() || null,
    proximosPassos: linhas(campos.proximosPassos),
    origem,
    modelo: origem === "ia" ? modelo : null,
  };
}

/**
 * Transcrição que o Meet, o Zoom ou o Teams exportam em WebVTT: tira o
 * cabeçalho, os números de bloco e as linhas de tempo, e fica o que foi
 * dito. Texto comum passa sem mudança.
 */
export function textoDaTranscricao(conteudo: string): string {
  const limpo = conteudo.replace(/^﻿/, "");
  if (!/^WEBVTT/.test(limpo.trimStart())) return limpo.trim();
  return limpo
    .split(/\r?\n/)
    .filter(
      (linha) =>
        !/^WEBVTT/.test(linha) &&
        !/^\d+$/.test(linha.trim()) &&
        !/-->/.test(linha) &&
        !/^(NOTE|STYLE|REGION)\b/.test(linha),
    )
    .map((linha) => linha.replace(/<[^>]+>/g, "").trim())
    .filter(Boolean)
    .join("\n");
}
