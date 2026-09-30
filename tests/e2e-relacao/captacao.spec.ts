import { expect, test } from "@playwright/test";
import { semRolagemLateral, semViolacaoGrave } from "../e2e/apoio/entrar";
import { dubleTurnstile } from "../e2e/p29-p30-venda/apoio";

/**
 * P47 · Página de captação /c/[canal]. Sem sessão: o botão só liga depois do
 * Turnstile, e o link wa.me leva o código de origem do canal no texto.
 */

test("o botão abre o WhatsApp com o código de origem do canal", async ({
  page,
}) => {
  await dubleTurnstile(page);
  // O WhatsApp é um site de fora: o teste só confere para onde a página vai.
  await page.route("https://wa.me/**", (rota) =>
    rota.fulfill({
      contentType: "text/html",
      body: "<title>WhatsApp de teste</title>",
    }),
  );

  await page.goto("/c/igbio?utm_source=instagram&utm_medium=bio&nome=Fulana");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await semRolagemLateral(page);
  await semViolacaoGrave(page);

  const botao = page.getByRole("button", { name: /Conversar pelo WhatsApp/ });
  await expect(botao).toBeEnabled();
  await botao.click();

  await page.waitForURL(/^https:\/\/wa\.me\//);
  const url = decodeURIComponent(page.url());
  expect(url).toMatch(/wa\.me\/\d{10,15}\?text=/);
  expect(url).toContain("KZ-IGBIO");
  // Nada da pessoa nem da query string vai para o WhatsApp.
  expect(url).not.toContain("Fulana");
});

test("canal que não existe mostra o aviso calmo, sem formulário", async ({
  page,
}) => {
  await page.goto("/c/naoexiste");
  await expect(page.getByText(/não está mais ativo/)).toBeVisible();
  await expect(page.getByRole("button", { name: /WhatsApp/ })).toHaveCount(0);
  await semRolagemLateral(page);
});

test("a página de candidatura nasce desligada: só o aviso, sem formulário", async ({
  page,
}) => {
  await page.goto("/candidatura");
  await expect(page.locator('[data-candidatura="desligada"]')).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Enviar candidatura/ }),
  ).toHaveCount(0);
  await expect(page.getByLabel("Nome completo")).toHaveCount(0);
  await semRolagemLateral(page);
  await semViolacaoGrave(page);
});
