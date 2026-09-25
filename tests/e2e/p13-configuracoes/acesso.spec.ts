import { expect, test } from "@playwright/test";
import {
  entrarComo,
  semRolagemLateral,
  semViolacaoGrave,
} from "../apoio/entrar";

/**
 * P13 (Configurações), modo demonstração: quem chega na tela e o que cada
 * papel vê (PRD 13, "Parâmetros e configurações": diretoria total,
 * coordenação só termos de alerta).
 */
test("diretoria vê todas as seções; coordenação só termos de alerta", async ({
  page,
}) => {
  await entrarComo(page, "Diretoria");
  await page.goto("/configuracoes");
  await expect(
    page.getByRole("heading", { level: 1, name: "Configurações" }),
  ).toBeVisible();

  for (const aba of [
    "Parâmetros",
    "Pacotes e preços",
    "Regiões e localidades",
    "Condições comerciais",
    "Mensagens",
    "Termos de alerta",
    "Régua",
  ]) {
    await expect(page.getByRole("link", { name: aba })).toBeVisible();
  }
  await semRolagemLateral(page);
  await semViolacaoGrave(page);
});

test("coordenação só vê termos de alerta, nunca preço", async ({ page }) => {
  await entrarComo(page, "Coordenação");
  await page.goto("/configuracoes");
  await expect(
    page.getByRole("heading", { level: 1, name: "Configurações" }),
  ).toBeVisible();

  await expect(
    page.getByRole("link", { name: "Termos de alerta" }),
  ).toBeVisible();
  for (const aba of [
    "Parâmetros",
    "Pacotes e preços",
    "Regiões e localidades",
    "Condições comerciais",
    "Mensagens",
    "Régua",
  ]) {
    await expect(page.getByRole("link", { name: aba })).toHaveCount(0);
  }
  // Nenhum preço aparece em texto nenhum da tela.
  await expect(page.getByText(/R\$\s*\d/)).toHaveCount(0);
  await semViolacaoGrave(page);
});

test("comercial não abre a rota de configurações", async ({ page }) => {
  await entrarComo(page, "Comercial");
  await page.goto("/configuracoes");
  await expect(page).not.toHaveURL(/\/configuracoes$/);
});
