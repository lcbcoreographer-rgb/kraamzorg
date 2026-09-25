import { expect, test } from "@playwright/test";
import { entrarComo } from "../apoio/entrar";
import { porProjeto } from "./apoio";

/** P13 item 7 (Faixas da régua, PRD 10.3): objetivo, gatilho e mensagem ligada. */
test("a diretoria edita o objetivo de uma faixa da régua", async ({
  page,
}, info) => {
  const faixa = porProjeto(info, "Faixa 1", "Faixa 4");
  const objetivo = `Objetivo de teste ${info.project.name} ${Date.now()}`;
  await entrarComo(page, "Diretoria");
  await page.goto("/configuracoes?aba=regua");

  await expect(page.getByRole("heading", { name: faixa })).toBeVisible();
  await page
    .getByRole("button", { name: `Editar ${faixa.toLowerCase()}` })
    .click();
  const dialogo = page.getByRole("dialog");
  await dialogo.getByLabel("Objetivo").fill(objetivo);
  await dialogo.getByRole("button", { name: "Salvar" }).click();
  await expect(dialogo).toBeHidden();

  await expect(page.getByText(objetivo)).toBeVisible();
});
