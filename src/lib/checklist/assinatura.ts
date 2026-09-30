/**
 * Assinatura do registro assistencial (PRD 6.5, P39 item 3): sha256 de
 * dados, resumo, profissional e hora, calculado no aparelho na hora de
 * assinar e recalculado no servidor (`privado.hash_registro`, migration
 * 0023) a partir do que chegou.
 *
 * O que entra no hash é um texto canônico, para o resultado não depender de
 * como cada lado imprime o JSON:
 *
 *   {"assinado_em_ms":<ms desde 1970>,"dados":<dados>,
 *    "profissional_id":"<uuid>","resumo":"<resumo>"}
 *
 * com as chaves de todo objeto em ordem crescente, sem espaço, lista na
 * ordem e valores como o JSON os escreve. O vetor de referência do teste
 * (`assinatura.test.ts`) é o mesmo do pgTAP `023_checklist_alertas.sql`:
 * se os dois lados divergirem, um dos dois testes quebra.
 *
 * Função pura: roda igual no aparelho, no servidor e nos testes. Só usa
 * `crypto.subtle`, que o navegador (contexto seguro) e o Node oferecem.
 */

/** Texto canônico de um valor JSON (chaves em ordem crescente, sem espaço). */
export function jsonCanonico(valor: unknown): string {
  if (valor === null) return "null";
  if (Array.isArray(valor)) {
    return `[${valor.map((item) => jsonCanonico(item === undefined ? null : item)).join(",")}]`;
  }
  switch (typeof valor) {
    case "object": {
      const objeto = valor as Record<string, unknown>;
      const chaves = Object.keys(objeto)
        .filter((chave) => objeto[chave] !== undefined)
        .sort(compararBytes);
      return `{${chaves
        .map(
          (chave) => `${JSON.stringify(chave)}:${jsonCanonico(objeto[chave])}`,
        )
        .join(",")}}`;
    }
    case "number":
      if (!Number.isFinite(valor)) {
        throw new Error("assinatura: número não finito não entra no registro");
      }
      return JSON.stringify(valor);
    case "string":
    case "boolean":
      return JSON.stringify(valor);
    default:
      throw new Error(`assinatura: tipo ${typeof valor} não entra no registro`);
  }
}

/** Ordem de byte (UTF-8) das chaves, a mesma de `collate "C"` no banco. */
function compararBytes(a: string, b: string): number {
  const codificador = new TextEncoder();
  const bytesA = codificador.encode(a);
  const bytesB = codificador.encode(b);
  const n = Math.min(bytesA.length, bytesB.length);
  for (let i = 0; i < n; i += 1) {
    if (bytesA[i] !== bytesB[i]) return bytesA[i]! - bytesB[i]!;
  }
  return bytesA.length - bytesB.length;
}

export interface EntradaAssinatura {
  dados: Record<string, unknown>;
  resumo: string;
  /** `profissional.id` (não o usuário) de quem assina. */
  profissionalId: string;
  /** Instante da assinatura em milissegundos desde 1970. */
  assinadoEmMs: number;
}

/** O texto que entra no sha256. */
export function textoAssinado(entrada: EntradaAssinatura): string {
  return jsonCanonico({
    assinado_em_ms: entrada.assinadoEmMs,
    dados: entrada.dados,
    profissional_id: entrada.profissionalId,
    resumo: entrada.resumo,
  });
}

function paraHexadecimal(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

/** sha256 em hexadecimal da assinatura do registro. */
export async function calcularAssinatura(
  entrada: EntradaAssinatura,
): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error(
      "assinatura: este aparelho não oferece crypto.subtle (precisa de conexão segura)",
    );
  }
  const bytes = new TextEncoder().encode(textoAssinado(entrada));
  return paraHexadecimal(
    await globalThis.crypto.subtle.digest("SHA-256", bytes),
  );
}

/** A assinatura recebida bate com o conteúdo? */
export async function conferirAssinatura(
  entrada: EntradaAssinatura,
  assinatura: string,
): Promise<boolean> {
  return (await calcularAssinatura(entrada)) === assinatura;
}
