import { expect, test, type Page } from "@playwright/test";
import {
  entrarComo,
  semRolagemLateral,
  semViolacaoGrave,
} from "../e2e/apoio/entrar";
import { dubleTurnstile } from "../e2e/p29-p30-venda/apoio";

/**
 * P49 · Portal da família por link mágico. No modo demonstração o "e-mail"
 * mostra um link de acesso na própria tela; na real quem envia é o Supabase
 * Auth. A família só vê a própria casa; em bloqueio_total, só o contato.
 */

async function pedirLink(page: Page, email: string) {
  await dubleTurnstile(page);
  await page.goto("/familia/entrar");
  await page.getByLabel("Seu e-mail").fill(email);
  const enviar = page.getByRole("button", { name: "Enviar o link" });
  await expect(enviar).toBeEnabled();
  await enviar.click();
  await expect(page.locator('[data-teste="link-enviado"]')).toBeVisible();
}

test("sem sessão, /familia leva para a entrada", async ({ page }) => {
  await page.goto("/familia");
  await expect(page).toHaveURL(/\/familia\/entrar/);
  await semRolagemLateral(page);
  await semViolacaoGrave(page);
});

test("e-mail desconhecido recebe a mesma resposta e nenhum link", async ({
  page,
}) => {
  await pedirLink(page, "ninguem@exemplo.invalid");
  await expect(page.locator('[data-teste="link-demonstracao"]')).toHaveCount(0);
});

test("a família entra pelo link e vê os próximos passos e as datas, só os dela", async ({
  page,
}) => {
  await pedirLink(page, "aurora.teste@exemplo.invalid");
  await page.locator('[data-teste="link-demonstracao"]').click();
  await page.waitForURL(/\/familia\/confirmar/);
  // O link só abre a página; quem gasta é o botão.
  await page.getByRole("button", { name: "Abrir o portal" }).click();
  await page.waitForURL((url) => url.pathname === "/familia");

  const portal = page.locator('[data-portal="ok"]');
  await expect(portal).toBeVisible();
  await expect(portal.locator("[data-passo]").first()).toBeVisible();
  await expect(portal.locator('[data-passo="contrato"]')).toHaveAttribute(
    "data-estado",
    "feito",
  );
  await expect(page.getByText("Brisa")).toHaveCount(0);
  await expect(page.getByText("Cais")).toHaveCount(0);
  await semRolagemLateral(page);
  await semViolacaoGrave(page);

  // A conta da família não abre tela da equipe.
  await page.goto("/pipeline");
  await expect(page).not.toHaveURL(/\/pipeline$/);
});

test("família em bloqueio_total nem recebe o link (mesma resposta de e-mail desconhecido)", async ({
  page,
}) => {
  await pedirLink(page, "cais.teste@exemplo.invalid");
  await expect(page.locator('[data-teste="link-demonstracao"]')).toHaveCount(0);
});

test("a equipe libera e suspende o acesso: comercial vê a lista, financeiro não", async ({
  page,
}) => {
  await entrarComo(page, "Comercial");
  await page.goto("/portal-familia");
  await expect(
    page.getByRole("heading", { level: 1, name: "Portal da família" }),
  ).toBeVisible();
  await expect(page.getByText("Família Teste Aurora")).toBeVisible();
  await semRolagemLateral(page);
  await semViolacaoGrave(page);

  await entrarComo(page, "Financeiro");
  await page.goto("/portal-familia");
  await expect(page).not.toHaveURL(/\/portal-familia$/);
});

test("coordenação decide se a família vê o nome e a foto da enfermeira", async ({
  page,
}) => {
  await entrarComo(page, "Coordenação");
  await page.goto("/portal-familia");
  await expect(
    page.getByRole("heading", { name: "Nome e foto das enfermeiras" }),
  ).toBeVisible();
  const linha = page
    .getByRole("listitem")
    .filter({ hasText: "Enfermeira Teste Beta" });
  await linha.getByLabel("A família vê o nome").check();
  await linha.getByRole("button", { name: /Salvar a autorização/ }).click();
  await expect(linha.getByRole("status")).toContainText(/salv|autoriza/i);
});
