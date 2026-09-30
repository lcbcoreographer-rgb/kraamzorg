import { expect, type Page } from "@playwright/test";

/** "aaaa-mm-dd" de hoje em Brasília, como o servidor calcula. */
export function hojeEmBrasilia(deslocamentoDias = 0): string {
  const base = new Date(Date.now() + deslocamentoDias * 86_400_000);
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo",
  }).format(base);
}

/** "R$ 1.250,00" ou "R$ 4.200" para centavos. */
export function moedaParaCentavos(texto: string): number {
  const limpo = texto.replace(/[^\d,-]/g, "");
  const [reais = "0", centavos = "0"] = limpo.split(",");
  const sinal = reais.startsWith("-") ? -1 : 1;
  return (
    sinal * (Math.abs(Number(reais)) * 100 + Number(centavos.padEnd(2, "0")))
  );
}

/**
 * Lê "entraram R$ X e saíram R$ Y" da frase que abre a visão do mês (no
 * financeiro) ou a seção Financeiro (no painel). As duas telas usam os mesmos
 * números do banco; este é o elo entre elas.
 */
export async function entraramESairam(
  page: Page,
): Promise<{ entraram: number; sairam: number }> {
  const corpo = await page.locator("body").innerText();
  const achou = corpo.match(
    /entraram\s+(R\$\s[\d.,]+)\s+e\s+sa[íi]ram\s+(R\$\s[\d.,]+)/,
  );
  expect(achou, "frase com entraram e saíram").not.toBeNull();
  return {
    entraram: moedaParaCentavos((achou as RegExpMatchArray)[1] as string),
    sairam: moedaParaCentavos((achou as RegExpMatchArray)[2] as string),
  };
}

/** Arquivo CSV de extrato, em memória, com o cabeçalho que o leitor reconhece. */
export function csvDeExtrato(
  linhas: { dataIso: string; descricao: string; valor: string }[],
): { name: string; mimeType: string; buffer: Buffer } {
  const corpo = linhas
    .map((l) => {
      const [a, m, d] = l.dataIso.split("-");
      return `${d}/${m}/${a};${l.descricao};${l.valor}`;
    })
    .join("\n");
  return {
    name: "extrato-ficticio.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(`Data;Descrição;Valor\n${corpo}\n`, "utf-8"),
  };
}
