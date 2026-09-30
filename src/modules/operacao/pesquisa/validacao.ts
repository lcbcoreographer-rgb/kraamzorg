import type {
  PerguntaPesquisa,
  RespostasPesquisa,
} from "@/lib/dados/tipos-ocorrencia";

/**
 * Conferência das respostas da pesquisa antes de enviar (P42). A tela confere
 * primeiro para a família corrigir sem esperar; o banco confere de novo por
 * dentro (public.pesquisa_enviar) e é quem decide. As perguntas vêm de
 * `parametro.pesquisa_perguntas`; nada aqui sabe quais são.
 */

/** Respostas como o formulário guarda: texto para tudo, convertido ao enviar. */
export type ValoresPesquisa = Record<string, string>;
export type ErrosPesquisa = Record<string, "obrigatorio" | "invalido">;

const LIMITE_TEXTO = 2000;

function vazio(valor: string | undefined): boolean {
  return valor === undefined || valor.trim() === "";
}

export function validarPesquisa(
  perguntas: readonly PerguntaPesquisa[],
  valores: ValoresPesquisa,
): ErrosPesquisa {
  const erros: ErrosPesquisa = {};
  for (const pergunta of perguntas) {
    const valor = valores[pergunta.id];
    if (vazio(valor)) {
      if (pergunta.obrigatoria) erros[pergunta.id] = "obrigatorio";
      continue;
    }
    const texto = valor!.trim();
    switch (pergunta.tipo) {
      case "escala_0_10":
        if (!/^(10|[0-9])$/.test(texto)) erros[pergunta.id] = "invalido";
        break;
      case "sim_nao":
        if (texto !== "sim" && texto !== "nao") erros[pergunta.id] = "invalido";
        break;
      case "opcao":
        if (!pergunta.opcoes?.some((o) => o.valor === texto)) {
          erros[pergunta.id] = "invalido";
        }
        break;
      case "texto":
        if (texto.length > LIMITE_TEXTO) erros[pergunta.id] = "invalido";
        break;
    }
  }
  return erros;
}

/** Converte o que a tela guardou para o formato que o banco espera (número, verdadeiro ou falso, texto). */
export function montarRespostas(
  perguntas: readonly PerguntaPesquisa[],
  valores: ValoresPesquisa,
): RespostasPesquisa {
  const respostas: RespostasPesquisa = {};
  for (const pergunta of perguntas) {
    const valor = valores[pergunta.id];
    if (vazio(valor)) continue;
    const texto = valor!.trim();
    switch (pergunta.tipo) {
      case "escala_0_10":
        respostas[pergunta.id] = Number(texto);
        break;
      case "sim_nao":
        respostas[pergunta.id] = texto === "sim";
        break;
      default:
        respostas[pergunta.id] = texto;
    }
  }
  return respostas;
}

/** Só texto curto e só as chaves esperadas: o que a ação do servidor aceita vindo do navegador. */
export function respostasLimpas(
  bruto: unknown,
): Record<string, string | number | boolean> | null {
  if (!bruto || typeof bruto !== "object" || Array.isArray(bruto)) return null;
  const entradas = Object.entries(bruto as Record<string, unknown>);
  if (entradas.length > 40) return null;
  const limpas: Record<string, string | number | boolean> = {};
  for (const [chave, valor] of entradas) {
    if (!/^[a-z0-9_]{1,40}$/.test(chave)) continue;
    if (typeof valor === "string") {
      if (valor.length > LIMITE_TEXTO) return null;
      limpas[chave] = valor;
    } else if (typeof valor === "number" && Number.isFinite(valor)) {
      limpas[chave] = valor;
    } else if (typeof valor === "boolean") {
      limpas[chave] = valor;
    } else {
      return null;
    }
  }
  return limpas;
}
