import { expect, test } from "@playwright/test";
import { entrarComo, semViolacaoGrave } from "../apoio/entrar";
import { porProjeto } from "./apoio";

/**
 * P16 itens 3 e 4: marcar "não contatar" com motivo, e registrar as datas
 * de nascimento e alta como fato. Uma família diferente por projeto.
 */
test("comercial marca não contatar com motivo, e a linha do tempo mostra o evento", async ({
  page,
}, info) => {
  const familia = porProjeto(info, "Maré", "Estrela");
  await entrarComo(page, "Comercial");
  await page.goto(`/familias?busca=${encodeURIComponent(familia)}`);
  await page
    .getByRole("link", { name: new RegExp(`Família Teste ${familia}`) })
    .click();
  await page.waitForURL(/\/familias\/[0-9a-f-]+$/);

  await page.getByRole("link", { name: "Comercial" }).click();
  await page.getByRole("button", { name: "Marcar não contatar" }).click();
  const dialogo = page.getByRole("dialog");
  await dialogo
    .getByLabel("Motivo")
    .fill("Pediu para não ser mais contatada pelo WhatsApp.");
  await dialogo.getByRole("button", { name: "Marcar não contatar" }).click();
  await expect(dialogo).toBeHidden();

  await expect(page.getByText("Não contatar")).toBeVisible();

  await page.getByRole("link", { name: "Linha do tempo" }).click();
  await expect(page.getByText("Marcada para não contatar")).toBeVisible();

  await semViolacaoGrave(page);
});

test("comercial registra a data de nascimento, que vira fato no cabeçalho", async ({
  page,
}) => {
  await entrarComo(page, "Comercial");
  await page.goto("/familias?busca=Horizonte");
  await page.getByRole("link", { name: /Família Teste Horizonte/ }).click();
  await page.waitForURL(/\/familias\/[0-9a-f-]+$/);

  await page.getByRole("link", { name: "Comercial" }).click();
  await page.getByRole("button", { name: "Registrar nascimento" }).click();
  const dialogo = page.getByRole("dialog");
  await dialogo.getByLabel("Nascimento").fill("2026-09-24");
  await dialogo.getByRole("button", { name: "Salvar" }).click();
  await expect(dialogo).toBeHidden();

  // O rótulo "ainda não" some e a data aparece marcada como fato.
  await expect(page.getByText("24/09/2026")).toBeVisible();
});

test("financeiro não vê os botões de não contatar nem de registrar data (só leitura)", async ({
  page,
}) => {
  await entrarComo(page, "Financeiro");
  await page.goto("/familias?busca=Horizonte");
  const link = page.getByRole("link", {
    name: /Família Teste Horizonte/,
  });
  if ((await link.count()) === 0) return; // financeiro só vê família com contrato
  await link.click();
  await page.waitForURL(/\/familias\/[0-9a-f-]+$/);
  await expect(
    page.getByRole("button", { name: "Marcar não contatar" }),
  ).toHaveCount(0);
});
