import { expect, test } from "@playwright/test";
import {
  entrarComo,
  semRolagemLateral,
  semViolacaoGrave,
} from "../apoio/entrar";

/**
 * Lista de famílias refeita em 30/09 (pedido do dono: "mais organizada e mais
 * fácil de visualizar"): filtros em pílula por fase com a contagem, busca que
 * filtra enquanto se digita, ordem e grupos pela fase. Modo demonstração.
 */
test("a coordenação vê as famílias agrupadas pela fase, com filtros em pílula", async ({
  page,
}) => {
  await entrarComo(page, /^Coordenação Perfil Teste/);
  await page.goto("/familias");

  await expect(
    page.getByRole("heading", { level: 1, name: "Famílias" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: /Gestando/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: /Em atendimento/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: /Com o freio puxado/ }),
  ).toBeVisible();

  const filtros = page.getByRole("group", {
    name: "Filtrar pela fase da família",
  });
  await expect(filtros.getByRole("button", { name: /^Todas/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  // A família em bloqueio não mostra estágio nem próximo passo comercial.
  const bruma = page.getByRole("link", { name: /Família Teste Bruma/ });
  await expect(bruma).toContainText("Freio em bloqueio total");
  await expect(bruma).toContainText("Só contato humano, pelo nome.");

  await semRolagemLateral(page);
  await semViolacaoGrave(page);
});

test("a busca filtra na hora e o filtro Com freio junta atenção e bloqueio", async ({
  page,
}) => {
  await entrarComo(page, "Comercial");
  await page.goto("/familias");

  await page.getByRole("searchbox", { name: "Buscar" }).fill("jade");
  await expect(
    page.getByRole("link", { name: /Família Teste Jade/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Família Teste Aurora/ }),
  ).toHaveCount(0);
  // Nada foi para a URL: a busca por nome fica na tela.
  expect(new URL(page.url()).search).toBe("");

  await page.getByRole("searchbox", { name: "Buscar" }).fill("");
  await page
    .getByRole("group", { name: "Filtrar pela fase da família" })
    .getByRole("button", { name: /^Com freio/ })
    .click();
  await expect(
    page.getByRole("link", { name: /Família Teste Estrela/ }),
  ).toContainText("Freio em atenção");
  await expect(
    page.getByRole("link", { name: /Família Teste Bruma/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Família Teste Aurora/ }),
  ).toHaveCount(0);

  // A linha abre a ficha.
  await page.getByRole("link", { name: /Família Teste Estrela/ }).click();
  await page.waitForURL(/\/familias\/[0-9a-f-]+$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Família Teste Estrela" }),
  ).toBeVisible();
});
