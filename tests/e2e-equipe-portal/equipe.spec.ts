import { expect, test } from "@playwright/test";
import {
  entrarComo,
  semRolagemLateral,
  semViolacaoGrave,
} from "../e2e/apoio/entrar";
import { ID_PROFISSIONAL_SUL_2 } from "./apoio";

/**
 * P37, aceite: "o estado muda para em visita no check-in e volta ao
 * anterior no check-out, sem tela que ofereça digitar o estado". Aqui, a
 * parte de tela: a equipe mostra o estado calculado e nenhuma tela deixa
 * marcá-lo. A mudança pelo check-in está em portal.spec.ts.
 */
test.describe("equipe da coordenação", () => {
  test.beforeEach(async ({ page }) => {
    await entrarComo(page, "Coordenação");
  });

  test("mostra cada enfermeira com o estado de hoje e a frase de resumo", async ({
    page,
  }) => {
    await page.goto("/equipe");
    await expect(
      page.getByRole("heading", { level: 1, name: "Equipe" }),
    ).toBeVisible();
    const cartao = page.locator(
      `[data-profissional="${ID_PROFISSIONAL_SUL_2}"]`,
    );
    await expect(cartao).toContainText("Profissional Teste Sul 2");
    await expect(cartao).toContainText("Em atendimento");
    await expect(page.locator("[data-profissional]")).not.toHaveCount(0);
    await semRolagemLateral(page);
    await semViolacaoGrave(page);
  });

  test("nenhuma tela oferece digitar ou escolher o estado da enfermeira", async ({
    page,
  }) => {
    const telas = [
      "/equipe",
      "/equipe/escala",
      `/equipe/${ID_PROFISSIONAL_SUL_2}`,
      "/equipe/nova",
    ];
    for (const tela of telas) {
      await page.goto(tela);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      // Nem campo, nem lista, nem botão para marcar "em visita", "livre" etc.
      await expect(
        page.getByLabel(/^Status\b|^Estado d[ae] (enfermeira|profissional)/i),
      ).toHaveCount(0);
      await expect(
        page.getByRole("combobox", {
          name: /status|estado d[ae] (enfermeira|profissional)/i,
        }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("radio", { name: /em visita|livre|em atendimento/i }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("button", {
          name: /marcar|definir.*estado|mudar.*estado/i,
        }),
      ).toHaveCount(0);
    }
  });

  test("a escala mostra a semana em turnos, com legenda", async ({ page }) => {
    await page.goto("/equipe/escala");
    await expect(
      page.getByRole("heading", { level: 1, name: /Escala/ }),
    ).toBeVisible();
    await expect(page.locator("[data-estado]").first()).toBeVisible();
    await semRolagemLateral(page);
    await semViolacaoGrave(page);
  });

  test("o cadastro tem documentos com validade e bloqueios de agenda", async ({
    page,
  }) => {
    await page.goto(`/equipe/${ID_PROFISSIONAL_SUL_2}`);
    await expect(
      page.getByRole("heading", { name: "Documentos" }),
    ).toBeVisible();
    await expect(page.getByText("Carteira do conselho").first()).toBeVisible();
    await expect(page.getByText("Vence em breve")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Bloqueios/ }),
    ).toBeVisible();
    await semRolagemLateral(page);
    await semViolacaoGrave(page);
  });
});
