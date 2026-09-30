import { expect, test } from "@playwright/test";
import {
  entrarComo,
  semRolagemLateral,
  semViolacaoGrave,
} from "../e2e/apoio/entrar";

/**
 * P47 e P48 · Marketing (relatório por origem, gerador de links, custo,
 * exportação) e copiloto interno. Modo demonstração; as fixtures são fictícias.
 */

test("diretoria vê receita e custo por origem e o gerador de links do canal", async ({
  page,
}) => {
  await entrarComo(page, "Diretoria");
  await page.goto("/marketing");
  await expect(
    page.getByRole("heading", { level: 1, name: "Marketing" }),
  ).toBeVisible();
  await expect(page.locator('[data-teste="frase-relatorio"]')).toContainText(
    "R$",
  );
  await expect(
    page.getByRole("table", { name: "Leads e receita por origem" }),
  ).toBeVisible();

  const canal = page.locator('[data-canal="IGBIO"]');
  await expect(canal).toBeVisible();
  await expect(canal).toContainText("KZ-IGBIO");
  await expect(
    canal.getByRole("button", { name: /Copiar o link do WhatsApp/ }),
  ).toBeVisible();
  await semRolagemLateral(page);
  await semViolacaoGrave(page);
});

test("canal novo entra na lista e código repetido é recusado com uma frase clara", async ({
  page,
}) => {
  await entrarComo(page, "Diretoria");
  await page.goto("/marketing");
  await page.getByLabel("Código").fill("FEIRA1");
  await page.getByLabel("Nome do canal").fill("Feira de teste");
  await page.getByRole("button", { name: /Criar canal|Salvar canal/ }).click();
  await expect(page.locator('[data-canal="FEIRA1"]')).toBeVisible();

  await page.getByLabel("Código").fill("FEIRA1");
  await page.getByLabel("Nome do canal").fill("Outra feira");
  await page.getByRole("button", { name: /Criar canal|Salvar canal/ }).click();
  await expect(
    page.getByText(/Já existe um canal com este código/),
  ).toBeVisible();
});

test("a exportação leva só famílias elegíveis e não tem telefone nem e-mail", async ({
  page,
}) => {
  await entrarComo(page, "Marketing");
  const resposta = await page.request.get("/marketing/exportar");
  expect(resposta.status()).toBe(200);
  expect(resposta.headers()["content-type"]).toContain("text/csv");
  const csv = await resposta.text();
  expect(csv).toContain("Família");
  expect(csv).not.toContain("Família Teste Kalu");
  expect(csv.toLowerCase()).not.toMatch(/telefone|e-mail|\+55/);
});

test("marketing sem permissão de valores não vê receita nem custo", async ({
  page,
}) => {
  await entrarComo(page, "Marketing");
  await page.goto("/marketing");
  await expect(
    page.getByRole("heading", { level: 1, name: "Marketing" }),
  ).toBeVisible();
  await expect(
    page.locator('[data-teste="frase-relatorio"]'),
  ).not.toContainText("R$");
  await semRolagemLateral(page);
});

test("comercial não abre o marketing", async ({ page }) => {
  await entrarComo(page, "Comercial");
  await page.goto("/marketing");
  await expect(page).not.toHaveURL(/\/marketing$/);
});

test("copiloto responde uma pergunta de pipeline com os números e o registro da consulta", async ({
  page,
}) => {
  await entrarComo(page, "Diretoria");
  await page.goto("/copiloto");
  await expect(
    page.getByRole("heading", { level: 1, name: "Copiloto" }),
  ).toBeVisible();
  await page
    .getByLabel("O que você quer saber?")
    .fill("Quantos leads entraram?");
  await page.getByRole("button", { name: "Perguntar" }).click();
  const resposta = page.locator('[data-teste="resposta-copiloto"]');
  await expect(resposta).toContainText(/\d+ leads entraram em todo o período/);
  await expect(page.locator('[data-teste="custo-mes"]')).toBeVisible();
  await semRolagemLateral(page);
  await semViolacaoGrave(page);
});

test("copiloto recusa pergunta assistencial ao comercial e receita por falta de permissão", async ({
  page,
}) => {
  await entrarComo(page, "Comercial");
  await page.goto("/copiloto");
  await page
    .getByLabel("O que você quer saber?")
    .fill("Qual o peso do bebê no checklist de ontem?");
  await page.getByRole("button", { name: "Perguntar" }).click();
  await expect(
    page.getByText(/não responde sobre registro assistencial/),
  ).toBeVisible();

  await page
    .getByLabel("O que você quer saber?")
    .fill("Qual foi a receita de setembro?");
  await page.getByRole("button", { name: "Perguntar" }).click();
  await expect(
    page.getByText(/Seu perfil não vê essa informação/),
  ).toBeVisible();
});
