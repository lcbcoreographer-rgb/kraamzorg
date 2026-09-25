import { expect, test } from "@playwright/test";
import { entrarComo, semViolacaoGrave } from "../apoio/entrar";

/**
 * P13 item 6 (Termos de alerta): ativar, desativar, ação e mensagem. Único
 * domínio que a coordenação também gerencia (PRD 13). Cada teste cria o
 * próprio termo, com um nome único (timestamp), para não colidir com outra
 * rodada em paralelo.
 */
test("a coordenação cria um termo de alerta e desativa em seguida", async ({
  page,
}, info) => {
  const termo = `teste tontura ${info.project.name} ${Date.now()}`;
  await entrarComo(page, "Coordenacao");
  await page.goto("/configuracoes");
  await semViolacaoGrave(page);

  await page.getByRole("button", { name: "Novo termo" }).click();
  const dialogo = page.getByRole("dialog");
  await dialogo.getByLabel("Termo").fill(termo);
  await dialogo.getByRole("button", { name: "Salvar" }).click();
  await expect(dialogo).toBeHidden();

  const linha = page.locator("tr", { hasText: termo });
  await expect(linha.getByText("Ativo")).toBeVisible();

  await linha.getByRole("button", { name: "Desativar" }).click();
  await expect(linha.getByText("Desativado")).toBeVisible();
});

test("a diretoria também gerencia termos de alerta", async ({ page }, info) => {
  const termo = `teste sangramento leve ${info.project.name} ${Date.now()}`;
  await entrarComo(page, "Diretoria");
  await page.goto("/configuracoes?aba=termos-alerta");

  await page.getByRole("button", { name: "Novo termo" }).click();
  const dialogo = page.getByRole("dialog");
  await dialogo.getByLabel("Termo").fill(termo);
  await dialogo.getByRole("button", { name: "Salvar" }).click();
  await expect(dialogo).toBeHidden();

  await expect(page.locator("tr", { hasText: termo })).toBeVisible();
});
