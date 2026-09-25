import { expect, test } from "@playwright/test";
import { entrarComo, semViolacaoGrave } from "../apoio/entrar";

/**
 * P17 · Deduplicação e mesclagem (a parte de tela; o cálculo de pontuação e
 * as funções `api.*` de detecção e mesclagem são de outra trilha, 0012 a
 * 0014). Cria, pelo cadastro manual do P15, uma família com o mesmo
 * telefone da Família Teste Aurora do seed: assim o teste não depende de
 * já existir uma duplicata pronta nos dados fictícios.
 */

test("duplicata certa por telefone: compara lado a lado e mescla, sem desfazer", async ({
  page,
}) => {
  await entrarComo(page, "Comercial");
  await page.goto("/pipeline?pipeline=1");

  await page.getByRole("button", { name: "Cadastrar lead" }).click();
  await page.getByLabel("Nome da família").fill("Família Teste E2E Duplicata");
  await page.getByLabel("Nome do contato").fill("Marina Duplicada");
  // Mesmo telefone da Família Teste Aurora do seed (+5511900000301).
  await page.getByLabel("Telefone do contato").fill("11900000301");
  await page.getByRole("button", { name: "Cadastrar" }).click();
  await expect(
    page.getByRole("heading", { name: "Cadastrar lead" }),
  ).toBeHidden();

  await page.getByRole("link", { name: "Duplicatas" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Duplicatas" }),
  ).toBeVisible();
  await semViolacaoGrave(page);

  await expect(
    page.getByRole("heading", { name: "Duplicata certa" }),
  ).toBeVisible();
  const linha = page
    .getByText("Família Teste Aurora e Família Teste E2E Duplicata")
    .first();
  await expect(linha).toBeVisible();

  await page.getByRole("link", { name: "Comparar e mesclar" }).first().click();
  await expect(
    page.getByRole("heading", { name: "Mesclar famílias" }),
  ).toBeVisible();
  await expect(page.getByText("Não há como desfazer")).toBeVisible();

  await page.getByRole("button", { name: "Mesclar as duas famílias" }).click();

  await expect(page).toHaveURL(/\/pipeline\/duplicatas\?mesclada=1$/);
  await expect(page.getByText("Famílias mescladas")).toBeVisible();
  // A duplicata resolvida não aparece mais na lista.
  await expect(
    page.getByText("Família Teste Aurora e Família Teste E2E Duplicata"),
  ).toHaveCount(0);
});
