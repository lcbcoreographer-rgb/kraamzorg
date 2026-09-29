import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Apoio dos e2e da operação (P35 e P36). Rodam só nos projetos
 * "celular-operacao" e "computador-operacao" (playwright.config.ts), cada um
 * com um servidor próprio: marcam consulta, designam, registram nascimento e
 * alta na loja em memória, e nada disso pode mexer nas famílias que os
 * outros testes leem. Cada teste usa uma família diferente, porque os
 * testes de um mesmo projeto rodam em paralelo sobre a mesma loja.
 */

/** "aaaa-mm-dd" de hoje em Brasília, somando dias corridos. */
export function diaBrasilia(somarDias = 0): string {
  const hoje = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
  const base = new Date(`${hoje}T12:00:00Z`);
  base.setUTCDate(base.getUTCDate() + somarDias);
  return base.toISOString().slice(0, 10);
}

/** "24/09/2026" a partir de "2026-09-24". */
export function dataBr(iso: string): string {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

/** O cartão da lista do pré-natal de uma família, pelo nome. */
export function cartaoConsulta(page: Page, nome: string): Locator {
  return page.locator("[data-consulta]", {
    has: page.getByRole("heading", { name: nome }),
  });
}

/** O cartão do radar de uma família, pelo nome. */
export function cartaoRadar(page: Page, nome: string): Locator {
  return page.locator("[data-radar], [data-nasceu]", {
    has: page.getByRole("heading", { name: nome }),
  });
}

/** Abre a alocação da família pelo radar (o id nunca é digitado no teste). */
export async function abrirAlocacao(page: Page, nome: string): Promise<void> {
  await page.goto("/radar");
  const cartao = cartaoRadar(page, nome);
  await expect(cartao).toBeVisible();
  await cartao
    .getByRole("link", { name: /Abrir alocação|Registrar a alta/ })
    .click();
  await page.waitForURL(/\/radar\/[0-9a-f-]+$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Alocação" }),
  ).toBeVisible();
}

/** Linhas de dados da tabela de visitas (sem o cabeçalho). */
export function linhasDeVisitas(page: Page): Locator {
  return page.locator("section[aria-labelledby='visitas'] tbody tr");
}
