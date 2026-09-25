import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * P10, item 5 e 7: /design-system passa no axe sem violação séria ou
 * crítica, nos dois projetos (celular e computador, ver playwright.config.ts).
 */
test.describe("/design-system", () => {
  test("carrega e mostra o título da direção visual", async ({ page }) => {
    await page.goto("/design-system");

    await expect(
      page.getByRole("heading", { name: "Caderneta de visita", level: 1 }),
    ).toBeVisible();
  });

  test("não tem violação de acessibilidade séria ou crítica (axe)", async ({
    page,
  }) => {
    await page.goto("/design-system");
    await page.waitForLoadState("networkidle");

    const resultado = await new AxeBuilder({ page }).analyze();

    const violacoesGraves = resultado.violations.filter(
      (violacao) =>
        violacao.impact === "serious" || violacao.impact === "critical",
    );

    expect(violacoesGraves, JSON.stringify(violacoesGraves, null, 2)).toEqual(
      [],
    );
  });
});
