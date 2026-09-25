import { expect, test } from "@playwright/test";

test.describe("página inicial", () => {
  test("a raiz leva quem não entrou para a tela de entrar", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(page).toHaveURL(/\/entrar$/);
    await expect(
      page.getByRole("heading", { name: "Entrar", level: 1 }),
    ).toBeVisible();
  });
});
