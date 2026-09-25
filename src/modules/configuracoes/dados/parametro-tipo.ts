import type { Json } from "@/lib/db/types";
import type { TipoParametro } from "./tipos";

/**
 * Classifica e valida o valor de um parâmetro (P13, "Fazer" item 1:
 * "validação por tipo de parâmetro"). `parametro.valor` é `jsonb` livre no
 * banco (CLAUDE.md); a única forma de validar sem inventar uma lista de
 * chaves no código é comparar o novo valor com a FORMA do valor atual: um
 * número continua número, uma lista de texto continua lista de texto, e
 * assim por diante. Isto pega o erro mais comum (apagar sem querer um
 * objeto inteiro, trocar um número por texto) sem exigir um catálogo de
 * chaves conhecidas mantido à mão.
 */

export function classificarTipoParametro(valor: Json): TipoParametro {
  if (valor === null) return "nulo";
  if (typeof valor === "boolean") return "booleano";
  if (typeof valor === "number") {
    return Number.isInteger(valor) ? "inteiro" : "decimal";
  }
  if (typeof valor === "string") return "texto";
  if (Array.isArray(valor)) {
    const todosTexto = valor.every((item) => typeof item === "string");
    return todosTexto ? "lista_texto" : "objeto";
  }
  return "objeto";
}

export type ResultadoValidacaoParametro =
  { ok: true; valor: Json } | { ok: false; erro: string };

/** Um item por linha, linhas em branco descartadas (edição de `lista_texto`). */
export function listaParaTexto(lista: readonly string[]): string {
  return lista.join("\n");
}

export function textoParaLista(texto: string): string[] {
  return texto
    .split("\n")
    .map((linha) => linha.trim())
    .filter((linha) => linha.length > 0);
}

function paraNumero(texto: string): number | null {
  const normalizado = texto.trim().replace(",", ".");
  if (normalizado === "") return null;
  const numero = Number(normalizado);
  return Number.isFinite(numero) ? numero : null;
}

/**
 * Valida o texto digitado contra o tipo do valor atual e devolve o `Json`
 * pronto para gravar, ou uma mensagem de erro pronta para a tela (PRD 20.3:
 * diz o que aconteceu e o que fazer).
 */
export function validarNovoValorParametro(
  tipo: TipoParametro,
  entrada: string,
): ResultadoValidacaoParametro {
  switch (tipo) {
    case "inteiro": {
      const numero = paraNumero(entrada);
      if (numero === null) {
        return { ok: false, erro: "Digite um número. Use só dígitos." };
      }
      if (!Number.isInteger(numero)) {
        return {
          ok: false,
          erro: "Este parâmetro é um número inteiro, sem casa decimal.",
        };
      }
      return { ok: true, valor: numero };
    }
    case "decimal": {
      const numero = paraNumero(entrada);
      if (numero === null) {
        return {
          ok: false,
          erro: "Digite um número. Vírgula ou ponto separam a casa decimal.",
        };
      }
      return { ok: true, valor: numero };
    }
    case "texto": {
      const texto = entrada.trim();
      if (texto === "") {
        return { ok: false, erro: "O texto não pode ficar em branco." };
      }
      return { ok: true, valor: texto };
    }
    case "lista_texto": {
      return { ok: true, valor: textoParaLista(entrada) };
    }
    case "booleano": {
      if (entrada !== "true" && entrada !== "false") {
        return {
          ok: false,
          erro: "Escolha sim ou não.",
        };
      }
      return { ok: true, valor: entrada === "true" };
    }
    case "objeto":
    case "nulo": {
      let json: Json;
      try {
        json = JSON.parse(entrada) as Json;
      } catch {
        return {
          ok: false,
          erro: "Este texto não é um JSON válido. Confira vírgulas e chaves e tente de novo.",
        };
      }
      if (tipo === "objeto") {
        const eraLista = Array.isArray(json);
        const ehObjeto = typeof json === "object" && json !== null && !eraLista;
        if (!ehObjeto && !eraLista) {
          return {
            ok: false,
            erro: "Este parâmetro é um objeto ou uma lista, não um texto solto nem um número.",
          };
        }
      }
      return { ok: true, valor: json };
    }
    default:
      return { ok: false, erro: "Tipo de parâmetro desconhecido." };
  }
}

/** Texto de exemplo mostrado como ajuda, conforme o tipo (PRD 20.3, microcopy). */
export function ajudaPorTipo(tipo: TipoParametro): string {
  switch (tipo) {
    case "inteiro":
      return "Um número inteiro, sem casa decimal.";
    case "decimal":
      return "Um número. Vírgula ou ponto separam a casa decimal.";
    case "booleano":
      return "Ligado ou desligado.";
    case "texto":
      return "Um texto simples.";
    case "lista_texto":
      return "Um item por linha.";
    case "nulo":
      return "Sem valor definido ainda. Digite um JSON válido para definir um.";
    case "objeto":
    default:
      return "Um objeto ou lista em JSON. Confira vírgulas e chaves antes de salvar.";
  }
}
