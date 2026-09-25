/**
 * Leitura de valores do registro da visita. Função pura, sem I/O.
 */

/**
 * Lê um caminho pontuado dentro do registro. Aceita as duas formas de
 * guardar a numeração do checklist, porque a definição do DOC 2 (P34) ainda
 * não fixou uma: chave literal com ponto (`{"2.1": {"temperatura": 38}}`) ou
 * aninhamento por segmento (`{"2": {"1": {"temperatura": 38}}}`). Em cada
 * nível tenta primeiro a chave mais longa possível, depois as mais curtas.
 */
export function obterValorPorCaminho(
  origem: Record<string, unknown> | undefined,
  caminho: string,
): unknown {
  if (!origem || caminho === "") return undefined;
  return resolver(origem, caminho.split("."));
}

function resolver(atual: unknown, partes: string[]): unknown {
  if (partes.length === 0) return atual;
  if (atual === null || typeof atual !== "object" || Array.isArray(atual)) {
    return undefined;
  }
  const objeto = atual as Record<string, unknown>;
  for (let tamanho = partes.length; tamanho >= 1; tamanho--) {
    const chave = partes.slice(0, tamanho).join(".");
    if (!Object.prototype.hasOwnProperty.call(objeto, chave)) continue;
    const valor = resolver(objeto[chave], partes.slice(tamanho));
    if (valor !== undefined) return valor;
  }
  return undefined;
}

const NUMERO_EM_TEXTO = /^\s*-?\d+(?:[.,]\d+)?\s*$/;

/**
 * Converte o valor observado em número quando ele é número ou texto
 * numérico ("38,2" ou "38.2", como o formulário offline pode guardar).
 * Qualquer outra coisa devolve `undefined`: nunca vira zero por acaso.
 */
export function comoNumero(valor: unknown): number | undefined {
  if (typeof valor === "number") {
    return Number.isFinite(valor) ? valor : undefined;
  }
  if (typeof valor === "string" && NUMERO_EM_TEXTO.test(valor)) {
    const numero = Number(valor.trim().replace(",", "."));
    return Number.isFinite(numero) ? numero : undefined;
  }
  return undefined;
}
