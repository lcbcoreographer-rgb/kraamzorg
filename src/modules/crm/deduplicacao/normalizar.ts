/**
 * Normalização usada na deduplicação (P17, PRD 6.10 regra 2: "telefone
 * normalizado" e "similaridade de nome") e no cadastro manual de lead
 * (P15 item 4, que também precisa gravar o telefone em E.164).
 *
 * Puro, sem acesso a banco: o casamento por `pg_trgm` de verdade é do
 * banco (privado, quando a migration chegar); aqui é a aproximação do lado
 * da tela, para o cadastro manual e para a tela de duplicatas rodarem no
 * modo demonstração.
 */

/**
 * Aceita um número já em E.164 ("+5511999998888") ou como a pessoa
 * costuma digitar no Brasil (com ou sem DDI, com ou sem pontuação).
 * Devolve null quando não dá para reconhecer um celular ou fixo brasileiro.
 */
export function normalizarTelefoneBr(entrada: string): string | null {
  const bruto = entrada.trim();
  if (bruto.startsWith("+")) {
    const digitos = bruto.slice(1).replace(/\D/g, "");
    return digitos.length >= 10 && digitos.length <= 15 ? `+${digitos}` : null;
  }
  const digitos = bruto.replace(/\D/g, "");
  if (digitos.length === 10 || digitos.length === 11) return `+55${digitos}`;
  if (digitos.length === 12 && digitos.startsWith("55")) return `+${digitos}`;
  if (digitos.length === 13 && digitos.startsWith("55")) return `+${digitos}`;
  return null;
}

/** Só os dígitos, para casar telefones mesmo se um dos dois não tem "+55". */
export function digitosTelefone(e164: string): string {
  return e164.replace(/\D/g, "");
}

/** Telefones iguais na comparação de duplicata certa (últimos 10 ou 11 dígitos). */
export function mesmoTelefone(a: string, b: string): boolean {
  const da = digitosTelefone(a).slice(-11);
  const db = digitosTelefone(b).slice(-11);
  return da.length >= 10 && da === db;
}

/** Minúsculo, sem acento e sem espaço duplicado, para comparar nomes. */
export function normalizarNome(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Aproximação de `extensions.similarity` (trigramas) em JavaScript: razão
 * de trigramas de caracteres em comum sobre o total. Serve só para o modo
 * demonstração; o corte real usa `parametro` e `pg_trgm` no banco.
 */
export function similaridadeNome(a: string, b: string): number {
  const trigramas = (texto: string): Set<string> => {
    const t = ` ${normalizarNome(texto)} `;
    const conjunto = new Set<string>();
    for (let i = 0; i < t.length - 2; i++) conjunto.add(t.slice(i, i + 3));
    return conjunto;
  };
  const ta = trigramas(a);
  const tb = trigramas(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let comuns = 0;
  for (const trigrama of ta) if (tb.has(trigrama)) comuns++;
  const uniao = ta.size + tb.size - comuns;
  return uniao === 0 ? 0 : comuns / uniao;
}

/** Diferença em dias de calendário entre duas datas "aaaa-mm-dd". */
export function diferencaDias(a: string, b: string): number | null {
  const re = /^(\d{4})-(\d{2})-(\d{2})$/;
  const pa = re.exec(a);
  const pb = re.exec(b);
  if (!pa || !pb) return null;
  const da = Date.UTC(Number(pa[1]), Number(pa[2]) - 1, Number(pa[3]));
  const db = Date.UTC(Number(pb[1]), Number(pb[2]) - 1, Number(pb[3]));
  return Math.abs(Math.round((da - db) / 86_400_000));
}
