import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

/**
 * Apoio dos testes de ponta a ponta no modo demonstração
 * (KZ_DADOS=demonstracao, playwright.config.ts): a tela de entrar é um
 * seletor das pessoas fictícias do seed e o MFA aceita o código do
 * protótipo. O e2e com Supabase de verdade (senha e TOTP) fica para quando
 * houver Docker (docs/sessoes/P07-app.md).
 */
export const CODIGO_MFA = "123456";

/**
 * Entra como a pessoa de teste do seed com esse papel, escrito como o
 * botão mostra ("Comercial" abre "Perfil Teste Comercial"; "Coordenação",
 * com acento) e passa pelo MFA se precisar. Pessoas criadas
 * por convite durante o teste não entram no filtro.
 */
export async function entrarComo(
  page: Page,
  rotulo: string | RegExp,
): Promise<void> {
  // Quem já entrou e abre /entrar vai direto para o início: para trocar de
  // pessoa na mesma página, a sessão anterior sai antes.
  await page.context().clearCookies();
  await page.goto("/entrar");
  await page
    .getByRole("button", {
      name:
        typeof rotulo === "string"
          ? new RegExp(`^${rotulo} Perfil Teste`)
          : rotulo,
    })
    .click();
  await page.waitForURL((url) => url.pathname !== "/entrar");
  await passarPeloMfa(page);
}

export async function passarPeloMfa(
  page: Page,
  antes?: (page: Page) => Promise<void>,
) {
  const caminho = new URL(page.url()).pathname;
  if (caminho !== "/mfa/cadastro" && caminho !== "/mfa/desafio") return;
  if (antes) await antes(page);
  await page.getByLabel("Código").fill(CODIGO_MFA);
  await page
    .getByRole("button", {
      name:
        caminho === "/mfa/cadastro" ? "Confirmar código" : "Confirmar e entrar",
    })
    .click();
  await page.waitForURL((url) => !url.pathname.startsWith("/mfa"));
}

/** Axe sem violação séria ou crítica (mesmo critério de design-system.spec.ts). */
export async function semViolacaoGrave(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle");
  const resultado = await new AxeBuilder({ page }).analyze();
  const graves = resultado.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
  expect(graves, JSON.stringify(graves, null, 2)).toEqual([]);
}

/** Sem rolagem horizontal da página (DESIGN.md, seção 3). */
export async function semRolagemLateral(page: Page): Promise<void> {
  const excesso = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(excesso).toBeLessThanOrEqual(0);
}
