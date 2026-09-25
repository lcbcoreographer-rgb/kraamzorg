import { expect, test } from "@playwright/test";

test.describe("página inicial", () => {
  test("carrega e mostra o nome do sistema", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { name: "Kraamzorg OS" }),
    ).toBeVisible();
  });
});
