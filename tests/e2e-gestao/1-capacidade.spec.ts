import { expect, test } from "@playwright/test";
import {
  entrarComo,
  semRolagemLateral,
  semViolacaoGrave,
} from "../e2e/apoio/entrar";

/**
 * P45, aceite: a capacidade mostra, por região e semana, a ocupação e a chance
 * de passar do limite; a sobrevenda provável vira alerta; o gráfico tem a
 * versão em tabela. Coordenação e diretoria abrem; as outras pessoas não.
 */
test.describe("capacidade das próximas semanas", () => {
  test("a coordenação vê as regiões, o gráfico e o alerta de sobrevenda", async ({
    page,
  }) => {
    await entrarComo(page, "Coordenação");
    await page.goto("/capacidade");
    await expect(
      page.getByRole("heading", { level: 1, name: "Capacidade" }),
    ).toBeVisible();

    // O alerta da sobrevenda provável (Londrina, no seed fictício da demonstração).
    await expect(page.getByText(/chance de sobrevenda/).first()).toBeVisible();

    // Cada região tem o seu gráfico, com descrição e legenda.
    const graficos = page.getByRole("group", {
      name: /Ocupação de .* nas próximas/,
    });
    await expect(graficos.first()).toBeVisible();
    expect(await graficos.count()).toBeGreaterThanOrEqual(2);
    await expect(page.getByText("Tranquila").first()).toBeVisible();

    // A versão em tabela existe e traz a chance de passar o limite.
    await page.getByText("Ver como tabela").first().click();
    await expect(
      page.getByText("Chance de passar o limite").first(),
    ).toBeVisible();

    await semRolagemLateral(page);
    await semViolacaoGrave(page);
  });

  test("explica como a previsão é feita e não expõe o número ao agente", async ({
    page,
  }) => {
    await entrarComo(page, "Coordenação");
    await page.goto("/capacidade");
    await expect(
      page.getByRole("heading", { name: "Como a previsão é feita" }),
    ).toBeVisible();
    await expect(page.getByText(/continua devolvendo só/)).toBeVisible();
    await page.getByText("Ver a distribuição usada").click();
    await expect(
      page.getByRole("list", {
        name: /Parte dos nascimentos em cada faixa/,
      }),
    ).toBeVisible();
  });

  test("a diretoria abre; comercial e financeiro voltam para o início", async ({
    page,
  }) => {
    await entrarComo(page, "Diretoria");
    await page.goto("/capacidade");
    await expect(
      page.getByRole("heading", { level: 1, name: "Capacidade" }),
    ).toBeVisible();
    await expect(page.getByText(/chance de sobrevenda/).first()).toBeVisible();

    for (const rotulo of ["Comercial", "Financeiro"]) {
      await entrarComo(page, rotulo);
      await page.goto("/capacidade");
      // A borda leva quem não tem o papel de volta para o início dele.
      await expect(page).not.toHaveURL(/\/capacidade/);
      await expect(
        page.getByRole("group", { name: /Ocupação de/ }),
      ).toHaveCount(0);
    }
  });
});
