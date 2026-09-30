import type { ZodError } from "zod";

/** Texto de um campo do formulário, aparado; vazio quando não veio. */
export function textoDoCampo(formulario: FormData, campo: string): string {
  const valor = formulario.get(campo);
  return typeof valor === "string" ? valor.trim() : "";
}

/** Primeira mensagem de cada campo de um erro do zod, para pintar o campo. */
export function camposComErro(erro: ZodError): Record<string, string> {
  const campos: Record<string, string> = {};
  for (const problema of erro.issues) {
    const campo = String(problema.path[0] ?? "");
    campos[campo] ??= problema.message;
  }
  return campos;
}

/** Número inteiro positivo digitado, ou null quando vazio ou inválido. */
export function inteiroDoCampo(valor: string): number | null {
  if (!/^\d{1,6}$/.test(valor)) return null;
  const n = Number(valor);
  return Number.isSafeInteger(n) ? n : null;
}

/**
 * Data "aaaa-mm-dd" válida no calendário (o seletor nativo já manda nesse
 * formato; isto protege quando o navegador não tem seletor).
 */
export function dataValida(valor: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const d = new Date(`${valor}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === valor;
}
