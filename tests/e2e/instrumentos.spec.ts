import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * P34: o gerador de formulário com o DOC 2 v1, no celular (390 px) e no
 * computador. Uma etapa por bloco, alvo de 52 px no checklist, gemelar com
 * uma aba por bebê, sem rolagem horizontal e sem violação séria de
 * acessibilidade. Página de vitrine, dados fictícios.
 */
test.describe("/design-system/instrumentos", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/design-system/instrumentos");
    await expect(
      page.getByRole("heading", { level: 2, name: /Chegada e preparo/ }),
    ).toBeVisible();
  });

  test("mostra o DOC 2 em etapas, com pílulas de 52 px", async ({ page }) => {
    await expect(page.getByText("Etapa 1 de 26")).toBeVisible();
    const pilula = page
      .getByRole("radiogroup", { name: /Pontualidade confirmada/ })
      .locator("label")
      .first();
    const caixa = await pilula.boundingBox();
    expect(caixa?.height ?? 0).toBeGreaterThanOrEqual(52);

    await pilula.click();
    await expect(
      page.getByRole("status").filter({ hasText: "Salvo no aparelho" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Próxima etapa" }).click();
    await expect(
      page.getByRole("heading", { level: 2, name: /Puérpera, estado geral/ }),
    ).toBeVisible();
    await expect(page.getByText("Etapa 2 de 26")).toBeVisible();
  });

  test("gemelar: bloco do bebê com uma aba por bebê", async ({ page }) => {
    const proxima = page.getByRole("button", { name: "Próxima etapa" });
    for (let i = 0; i < 16; i += 1) await proxima.click();
    await expect(
      page.getByRole("heading", { level: 2, name: /Sinais vitais do RN/ }),
    ).toBeVisible();
    await expect(page.getByRole("tab")).toHaveCount(2);
    await page.getByLabel(/Peso/).fill("2890");
    await page.getByRole("tab", { name: "Bebê 2" }).click();
    await expect(page.getByLabel(/Peso/)).toHaveValue("");
    await page.getByRole("tab", { name: "Bebê 1" }).click();
    await expect(page.getByLabel(/Peso/)).toHaveValue("2890");
  });

  test("não rola de lado em 360 e 390 px", async ({ page }) => {
    for (const largura of [360, 390]) {
      await page.setViewportSize({ width: largura, height: 844 });
      const larguras = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(larguras.scrollWidth).toBeLessThanOrEqual(larguras.clientWidth);
    }
  });

  test("não tem violação de acessibilidade séria ou crítica (axe)", async ({
    page,
  }) => {
    const resultado = await new AxeBuilder({ page }).analyze();
    const graves = resultado.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(graves, JSON.stringify(graves, null, 2)).toEqual([]);
  });
});
