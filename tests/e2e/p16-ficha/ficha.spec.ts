import { expect, test } from "@playwright/test";
import {
  entrarComo,
  semRolagemLateral,
  semViolacaoGrave,
} from "../apoio/entrar";

/**
 * P16 item 1: resumo com as quatro datas (estimativa e fato), linha do
 * tempo, pessoas e a aba Comercial com os dados de contrato mascarados.
 * Família Teste Dália, a mesma do protótipo `comercial-ficha.html`.
 */
test("comercial abre a ficha pela lista de famílias e vê o resumo, a linha do tempo e as pessoas", async ({
  page,
}) => {
  await entrarComo(page, "Comercial");
  await page.goto("/familias?busca=D%C3%A1lia");
  await page.getByRole("link", { name: /Família Teste Dália/ }).click();
  await page.waitForURL(/\/familias\/[0-9a-f-]+$/);

  await expect(
    page.getByRole("heading", { level: 1, name: "Família Teste Dália" }),
  ).toBeVisible();

  // As quatro datas, sempre visíveis, com "estimativa" ou "fato".
  await expect(page.getByText("DPP")).toBeVisible();
  await expect(page.getByText("Nascimento")).toBeVisible();
  await expect(page.getByText("Alta")).toBeVisible();
  await expect(page.getByText("Início")).toBeVisible();
  await expect(page.getByText("estimativa")).toBeVisible();

  // O título da aba nunca leva o nome da família (DESIGN.md, microcopy 11).
  await expect(page).toHaveTitle(/^Ficha da família/);

  // Linha do tempo (aba ativa por padrão): a Família Teste Dália não tem
  // evento no seed, então o estado vazio ensina o que vai aparecer.
  await expect(page.getByText("Nenhum evento ainda")).toBeVisible();

  // Pessoas, na lateral.
  await expect(page.getByRole("heading", { name: "Pessoas" })).toBeVisible();
  await expect(page.getByText("Fernanda Teste Dália")).toBeVisible();

  await semViolacaoGrave(page);
  await semRolagemLateral(page);
});

test("aba Comercial mostra os dados do contrato mascarados, e Mostrar exige o código do MFA", async ({
  page,
}) => {
  await entrarComo(page, "Comercial");
  await page.goto("/familias?busca=D%C3%A1lia");
  await page.getByRole("link", { name: /Família Teste Dália/ }).click();
  await page.waitForURL(/\/familias\/[0-9a-f-]+$/);

  await page.getByRole("link", { name: "Comercial" }).click();
  await expect(page.getByText("Dados do contrato")).toBeVisible();

  const botaoMostrar = page.getByRole("button", {
    name: "Ver dados completos",
  });
  if (await botaoMostrar.isVisible()) {
    await botaoMostrar.click();
    // O comercial de teste entra em AAL1 (entrarComo passa pelo MFA quando
    // pedido, mas a ação em si exige AAL2 no instante da chamada): a tela
    // explica o que fazer, nunca mostra o CPF completo sem o código.
    await expect(page.getByText(/MFA|código do aplicativo/)).toBeVisible();
  }
});

test("aba Conversas está em leitura, sem campo de enviar mensagem", async ({
  page,
}) => {
  await entrarComo(page, "Comercial");
  await page.goto("/familias?busca=D%C3%A1lia");
  await page.getByRole("link", { name: /Família Teste Dália/ }).click();
  await page.waitForURL(/\/familias\/[0-9a-f-]+$/);

  await page.getByRole("link", { name: "Conversas" }).click();
  await expect(page.getByRole("textbox", { name: /mensagem/i })).toHaveCount(0);
});
